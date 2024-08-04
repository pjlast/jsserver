import { TextDocuments, createConnection, LogMessageNotification, DiagnosticSeverity } from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import { checkCode } from "./parse";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
    return ({
        capabilities: {
            textDocumentSync: documents.syncKind,
            hoverProvider: true,
        },
    })
})

documents.onDidOpen(change => {
    let code = change.document.getText()

    try {
        checkCode(code)
        connection.sendDiagnostics({
            uri: change.document.uri,
            diagnostics: []
        })
    } catch (e) {
        if (e.loc) {
        connection.sendDiagnostics({
            uri: change.document.uri,
            diagnostics:
                [{
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: {
                            line: e.loc.start.line - 1,
                            character: e.loc.start.column
                        },
                        end: {
                            line: e.loc.end.line - 1,
                            character: e.loc.end.column
                        }
                    },
                    message: e.message
                }]
        })
        }
    }
})

documents.onDidChangeContent(change => {
    let code = change.document.getText()

    try {
        checkCode(code)
        connection.sendDiagnostics({
            uri: change.document.uri,
            diagnostics: []
        })
    } catch (e) {
        if (e.loc) {
        connection.sendDiagnostics({
            uri: change.document.uri,
            diagnostics:
                [{
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: {
                            line: e.loc.start.line - 1,
                            character: e.loc.start.column
                        },
                        end: {
                            line: e.loc.end.line - 1,
                            character: e.loc.end.column
                        }
                    },
                    message: e.message
                }]
        })
        }
    }}
)

documents.listen(connection)
connection.listen()

