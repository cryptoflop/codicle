import * as vscode from 'vscode'
import { createHash } from 'crypto'
import fs from 'fs';

import { captureScreen, captureWindow, numScreens, focusedWindowId } from "../rs/index"
import WebViewProvider from './WebViewProvider'

export function activate(context: vscode.ExtensionContext) {
	const webViewProvider = new WebViewProvider(context.extensionUri)

	context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codicle.mini', webViewProvider)
  )

	context.subscriptions.push(vscode.commands.registerCommand('codicle.window', () => {
		const windowId = focusedWindowId()
		if (windowId === null) { return }
		let lastHash = ""
		setInterval(() => {
			if (vscode.window.state.focused) {
				const capture = captureWindow(windowId)
				if (capture) {
					const hash = createHash('sha1').update(capture.data).digest("hex")
					if (lastHash === hash) { return }
					lastHash = hash
					
					fs.writeFile("E:/dev/codicle/out.txt", Buffer.from(capture.data).toString('base64'), () => 1)

					webViewProvider.send({ ev: "capture", data: capture.data })
					// console.log(capture)
				}
			}
		}, 1000)
	}))

	context.subscriptions.push(vscode.commands.registerCommand('codicle.screen', () => {
		const screenIdx = 0
		console.log(captureScreen(screenIdx))
	}))

	

	// console.log(vscode.env.appName, vscode.env.sessionId)
}

module.exports.deactivate = function() {}