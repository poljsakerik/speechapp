import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(
      entry.name + (entry.isDirectory() ? "/" : ""),
      directory,
    );
    return entry.isDirectory() ? files(path) : [path];
  });

test("UI text and accessible labels go through translations", () => {
  const failures = [];
  for (const file of files(new URL("../src/", import.meta.url)).filter((path) =>
    path.pathname.endsWith(".tsx"),
  )) {
    const source = ts.createSourceFile(
      file.pathname,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      const literalText = ts.isJsxText(node) && /[a-zA-Z]/.test(node.text);
      const literalLabel =
        ts.isJsxAttribute(node) &&
        [
          "aria-label",
          "title",
          "placeholder",
          "alt",
          "description",
          "label",
          "note",
          "meta",
        ].includes(node.name.getText(source)) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /[a-zA-Z]/.test(node.initializer.text);
      if (literalText || literalLabel)
        failures.push(
          `${file.pathname}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${node.getText(source).trim()}`,
        );
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(failures, []);
});
