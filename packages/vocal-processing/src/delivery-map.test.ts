import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bare,
  carryMap,
  DELIVERY_MAP_VERSION,
  mapDelivery,
  mapParts,
  mapRequest,
  pacingOf,
  parseMap,
  placesOf,
  type DeliveryMap,
  type Place,
} from "./delivery-map.ts";
import type { JsonCompletion } from "./types.ts";

const words = "We looked at the data. It was clear, wasn't it?"
  .split(" ")
  .map((text) => ({ text }));
type Phrase = [pause: Place, pace: number];
/** A reply that ends a phrase after each of `ends`, and at the last word asked about. */
const reply =
  (
    ends: Record<number, Phrase>,
    rest: Phrase = ["optional", 0],
  ): JsonCompletion =>
  async ({ user }) => {
    const [, from, to] = user.match(/Split words (\d+)-(\d+)/)!.map(Number);
    return {
      phrases: [
        ...Object.entries(ends)
          .map(([last, [pause, pace]]) => ({ last: Number(last), pause, pace }))
          .filter((p) => p.last >= from && p.last < to),
        { last: to, pause: rest[0], pace: rest[1] },
      ],
    };
  };

test("the model reads the words without the recognizer's punctuation or capitals", () => {
  const { user } = mapRequest(words);
  assert.match(
    user,
    /0:we 1:looked 2:at 3:the 4:data 5:it 6:was 7:clear 8:wasn't 9:it\n/,
  );
  assert.match(user, /Split words 0-9 into phrases\.$/);
  // A script the speaker wrote keeps its punctuation.
  assert.match(mapRequest(words, [0, 9], true).user, /4:data\. 5:It/);
  assert.deepEqual(["$5,", "“Stop!”", "50%.", "—"].map(bare), [
    "$5",
    "stop",
    "50%",
    "—",
  ]);
});

test("the phrases must cover the words asked about, in order, to the last one, each with a pause and a pace", () => {
  const phrases = [
    { last: 4, pause: "needed", pace: -1 },
    { last: 9, pause: "land", pace: -2 },
  ];
  assert.deepEqual(parseMap({ phrases }, [0, 9]), phrases);
  for (const bad of [
    [phrases[0]],
    [{ last: 6, pause: "optional", pace: 0 }, ...phrases],
    [{ last: 9, pause: "often", pace: 0 }],
    [{ last: 9, pause: "optional", pace: 3 }],
    [{ last: 9, pause: "optional" }],
    [{ last: 12, pause: "optional", pace: 0 }],
    [],
  ])
    assert.equal(parseMap({ phrases: bad }, [0, 9]), undefined);
});

test("a long text is marked up in parts that end at a sentence end", () => {
  const long = Array.from({ length: 300 }, (_, i) => ({
    text: i % 50 === 49 ? `w${i}.` : `w${i}`,
  }));
  assert.deepEqual(mapParts(long), [
    [0, 149],
    [150, 299],
  ]);
  // Without sentence ends, a part still ends.
  assert.deepEqual(
    mapParts(Array.from({ length: 200 }, (_, i) => ({ text: `w${i}` }))),
    [
      [0, 179],
      [180, 199],
    ],
  );
});

test("one reply gives each phrase its pause and its pace", async () => {
  const map = await mapDelivery(
    words,
    reply({ 4: ["needed", -1], 7: ["optional", 1] }, ["land", -2]),
    { readings: 1 },
  );
  assert.deepEqual(map, {
    version: DELIVERY_MAP_VERSION,
    phrases: [
      { last: 4, pause: "needed", pace: -1 },
      { last: 7, pause: "optional", pace: 1 },
      // Nothing follows the last phrase, so its pause means nothing.
      { last: 9, pause: "optional", pace: -2 },
    ],
  });
  // A pause fits after each phrase and nowhere inside one; nothing follows the last word.
  assert.deepEqual(placesOf(map!, 10), [
    null,
    null,
    null,
    null,
    "needed",
    null,
    null,
    "optional",
    null,
    null,
  ]);
  // The same phrases are what the pace is measured over.
  assert.deepEqual(pacingOf(map!), {
    phrases: [
      [0, 4],
      [5, 7],
      [8, 9],
    ],
    scores: [-1, 1, -2],
  });
});

test("read three times, each place gets the middle answer and each phrase the pace of its words", async () => {
  let reading = 0;
  const readings: Record<number, Phrase>[] = [
    { 4: ["needed", -2], 7: ["land", 0] },
    { 4: ["land", -1], 7: ["optional", 2], 1: ["optional", 1] },
    { 4: ["anticipation", -1] },
  ];
  const map = await mapDelivery(
    words,
    (request) => reply(readings[reading++])(request),
    { readings: 3 },
  );
  assert.equal(reading, 3);
  // Two of three hold the pause after "data", one of them to let it land; "clear" is optional in the middle;
  // one reading alone doesn't end a phrase after "looked".
  assert.deepEqual(map!.phrases, [
    { last: 4, pause: "land", pace: -1 },
    { last: 7, pause: "optional", pace: 0 },
    { last: 9, pause: "optional", pace: 0 },
  ]);
});

test("without a model or a complete reply there is no map", async () => {
  assert.equal(await mapDelivery(words), undefined);
  assert.equal(
    await mapDelivery(words, async () => ({ phrases: [] })),
    undefined,
  );
  // An incomplete reply is asked again once.
  let calls = 0;
  const flaky: JsonCompletion = async (request) =>
    ++calls === 1 ? { phrases: [] } : reply({})(request);
  assert.ok(await mapDelivery(words, flaky, { readings: 1 }));
  assert.equal(calls, 2);
  // A reading that stays incomplete is left out of the map; the others make it.
  calls = 0;
  const once: JsonCompletion = async (request) =>
    // The first reading's request and its repeat.
    [1, 4].includes(++calls)
      ? { phrases: [] }
      : reply({ 4: ["needed", -1] })(request);
  assert.deepEqual(
    (await mapDelivery(words, once, { readings: 3 }))!.phrases[0],
    {
      last: 4,
      pause: "needed",
      pace: -1,
    },
  );
  assert.equal(calls, 4);
});

test("a map carries over to another take of the same text, except where the take leaves it", () => {
  const script: DeliveryMap = {
    version: DELIVERY_MAP_VERSION,
    phrases: [
      { last: 4, pause: "needed", pace: -1 },
      { last: 7, pause: "optional", pace: 1 },
      { last: 9, pause: "land", pace: -2 },
    ],
  };
  // The second take adds a filler, restarts a word and is punctuated differently.
  const take = "We looked at the the data, um, it was clear. Wasn't it?"
    .split(" ")
    .map((text) => ({ text }));
  const carried = carryMap(script, words, take);
  assert.deepEqual(carried.places, [
    null, // We
    null, // looked
    null, // at
    undefined, // the (said twice: the second is not in the text)
    undefined, // the
    "needed", // data, (the phrase ends here, whatever follows)
    undefined, // um,
    null, // it
    null, // was
    "optional", // clear.
    null, // Wasn't
    undefined, // it?
  ]);
  // The text's phrases, over the words of this take.
  assert.deepEqual(carried.pacing, {
    phrases: [
      [0, 5],
      [7, 9],
      [10, 11],
    ],
    scores: [-1, 1, -2],
  });
  // A word the recognizer heard differently still stands for the word in the text.
  const misheard = "We looked at a data. It was clear, wasn't it?"
    .split(" ")
    .map((text) => ({ text }));
  assert.deepEqual(
    carryMap(script, words, misheard).places.slice(0, 9),
    placesOf(script, 10).slice(0, 9),
  );
});
