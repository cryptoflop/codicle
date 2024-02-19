import { captureScreen, captureWindow, focusedWindowId, numScreens } from "./index.js"

import fs from "fs"

// const a = captureWindow(focusedWindowId())

const a = captureScreen(1)

// const _dirname = resolve(__dirname, "..", "rs")

console.log(a)
fs.createWriteStream("./test.jpg").write(a.image);
fs.createWriteStream("./test_thumb.jpg").write(a.thumbnail);