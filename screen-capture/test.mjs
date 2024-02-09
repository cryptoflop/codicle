import { captureScreen, captureWindow, focusedWindowId } from "./index.js"

import fs from "fs"

const a = captureWindow(focusedWindowId())

// const _dirname = resolve(__dirname, "..", "rs")

console.log(a)
fs.createWriteStream("./test.jpg").write(a.data);