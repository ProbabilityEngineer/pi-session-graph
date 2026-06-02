#!/usr/bin/env node
import { runCli } from "../index.js";
try {
    console.log(await runCli());
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
//# sourceMappingURL=pigraph.js.map