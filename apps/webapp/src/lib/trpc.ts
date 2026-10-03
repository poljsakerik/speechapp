import { QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  splitLink,
} from "@trpc/client";
import {
  createTRPCOptionsProxy,
  type TRPCOptionsProxy,
} from "@trpc/tanstack-react-query";

import type { AppRouter } from "@micmane/backend";

export const queryClient = new QueryClient();

const url = "/trpc";

export const trpc: TRPCOptionsProxy<AppRouter> =
  createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({
      links: [
        // Uploads go as multipart FormData, which batching can't carry.
        splitLink({
          condition: (op) => isNonJsonSerializable(op.input),
          true: httpLink({ url }),
          false: httpBatchLink({ url }),
        }),
      ],
    }),
    queryClient,
  });
