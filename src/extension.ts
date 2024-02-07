import * as vscode from 'vscode'
import { createHash } from 'crypto'
import { gzip } from 'node:zlib'

import { captureScreen, captureWindow, numScreens, focusedWindowId } from "../rs/index"
import WebViewProvider from './WebViewProvider'

export function activate(context: vscode.ExtensionContext) {
	const webViewProvider = new WebViewProvider(context.extensionUri)

	context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codicle.mini', webViewProvider)
  )

	function useCaptureHandler(captureFn: () => { data: Uint8Array } | null, interval = 1000) {
		let lastHash = ""
		const handle = setInterval(() => {
			if (vscode.window.state.focused) {
				const capture = captureFn()
				if (capture) {
					const hash = createHash('sha1').update(capture.data).digest("hex")
					if (lastHash === hash) { return }
					lastHash = hash
					
					webViewProvider.send({ ev: "capture", data: capture.data })

					gzip(capture.data, (err, buffer) => {
						console.log(buffer.length, capture.data.length);
					})
				}
			}
		}, interval)
		return () => clearInterval(handle)
	}

	context.subscriptions.push(vscode.commands.registerCommand('codicle.window', () => {
		const windowId = focusedWindowId()
		if (windowId === null) { return }
		useCaptureHandler(() => captureWindow(windowId))
	}))

	context.subscriptions.push(vscode.commands.registerCommand('codicle.screen', () => {
		const screenIdx = 0
		useCaptureHandler(() => captureScreen(screenIdx))
	}))

	// console.log(vscode.env.appName, vscode.env.sessionId)
}

module.exports.deactivate = function() {}