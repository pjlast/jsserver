import {
  TextDocuments,
  createConnection,
  DiagnosticSeverity,
  TextDocumentSyncKind,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import { checkCode } from "./parse";

import { TypeInferenceError } from "./inference";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
    },
  };
});

function checckAndSendDiagnostics(connection, change) {
  let code = change.document.getText();
  try {
    checkCode(code);
    connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics: [],
    });
  } catch (e) {
    if (e instanceof TypeInferenceError) {
      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: [
          {
            severity: DiagnosticSeverity.Error,
            range: {
              start: {
                line: e.loc.start.line - 1,
                character: e.loc.start.column,
              },
              end: {
                line: e.loc.end.line - 1,
                character: e.loc.end.column,
              },
            },
            message: e.message,
          },
        ],
      });
    }
  }
}

documents.onDidOpen((change) => {
  checckAndSendDiagnostics(connection, change);
});

documents.onDidChangeContent((change) => {
  checckAndSendDiagnostics(connection, change);
});

documents.listen(connection);
connection.listen();
