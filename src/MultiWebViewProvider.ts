import * as vscode from 'vscode';
import { randomUUID } from 'crypto'

export default class MultiWebViewProvider {
  public views = new Map<string, vscode.WebviewView>()

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    const id = randomUUID()
    this.views.set(id, webviewView)

    webviewView.webview.options = { 
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    }

    webviewView.onDidDispose(() => this.views.delete(id))

    webviewView.webview.html = this.getHtml(id, webviewView.webview)
  }

  getHtml(id: string, webview: vscode.Webview) {

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css'))
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js'))
    const assetsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets'))

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${id}</title>
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <script>self.assetsDir = "${assetsUri.toString()}"</script>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `
  }
}