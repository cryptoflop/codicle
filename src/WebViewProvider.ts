import * as vscode from 'vscode';

export default class WebViewProvider {
  private view?: vscode.WebviewView;
  private nounce = Date.now();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    this.reload();

    webviewView.webview.onDidReceiveMessage(msg => {
      
    });
  }

  public send(msg: unknown) {
    this.view?.webview.postMessage(msg);
  }

  public reload() {
    if (this.view) {
      this.nounce = Date.now();
      this.view.webview.html = this.getHtml();
    }
  }

  getHtml() {
    const webview = this.view!.webview

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js'));

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;

    //   <script type="importmap">
    //   {
    //     "imports": {
    //       "three": "https://unpkg.com/three@0.161.0/build/three.module.min.js",
    //       "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
    //     }
    //   }
    // </script>
  }
}