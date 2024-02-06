import { captureScreen, captureWindow } from "./index.js"

import fs from "fs"

const a = captureWindow()

// const _dirname = resolve(__dirname, "..", "rs")

console.log(a)
fs.createWriteStream("./test.jpg").write(a.data);