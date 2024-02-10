import * as vscode from 'vscode'
import { randomUUID } from 'crypto'

export default class WebViewPanel {

	public static currentPanel: WebViewPanel | undefined;

	public static readonly viewType = 'codicle'

	public readonly panel: vscode.WebviewPanel
	private readonly _extensionUri: vscode.Uri

	public static toggle(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined

		if (WebViewPanel.currentPanel) {
      if (WebViewPanel.currentPanel.panel.visible) {
        WebViewPanel.currentPanel.panel.dispose()
      } else {
        WebViewPanel.currentPanel.panel.reveal(column)
      }
			return
		}

		const panel = vscode.window.createWebviewPanel(
			WebViewPanel.viewType,
			'Codicle',
			column || vscode.ViewColumn.One,
			{ enableScripts: true, localResourceRoots: [extensionUri] }
		)

		WebViewPanel.currentPanel = new WebViewPanel(panel, extensionUri)
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this.panel = panel
		this._extensionUri = extensionUri

		panel.webview.html = this.getHtml()

		panel.onDidDispose(() => WebViewPanel.currentPanel = undefined)
	}

  getHtml() {
    const webview = this.panel!.webview

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css'))
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js'))

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${randomUUID()}</title>
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `
  }

}