// Inspects the members of the runIf result union which tsd reports as `Promise<null> | Promise<null>`.
const ts = require('/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads/node_modules/typescript');
const path = require('path');
const dts = process.argv[2];
const file = path.join(__dirname, 'identity-probe.ts');
const source = `
import { runIf } from './${path.basename(dts, '.d.ts')}';
declare const aNumeralOrNullPromise: Promise<number | null>;
declare const increment: (value: number) => number;
declare const returnNull: (value: number) => null;
declare const convertNumberToString: (value: number) => string;
export const x = runIf(aNumeralOrNullPromise, increment, returnNull, convertNumberToString);
export const y: Promise<null> = null as any;
`;
require('fs').writeFileSync(file, source);
const program = ts.createProgram([file], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2017, moduleResolution: ts.ModuleResolutionKind.NodeJs });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(file);
const diags = ts.getPreEmitDiagnostics(program);
if (diags.length) console.log('diagnostics:', diags.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
function typeOf(name) {
	const decl = sf.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations[0].name.text == name).declarationList.declarations[0];
	return checker.getTypeAtLocation(decl.name);
}
const x = typeOf('x'), y = typeOf('y');
const members = x.isUnion() ? x.types : [x];
console.log('x:', checker.typeToString(x), '| members:', members.length);
for (const m of members) {
	console.log(`  id=${m.id} ${checker.typeToString(m)} alias=${m.aliasSymbol ? m.aliasSymbol.name : '-'} args=${(m.typeArguments || []).map(a => `${a.id}:${checker.typeToString(a)}${a.aliasSymbol ? '(' + a.aliasSymbol.name + ')' : ''}${a.flags & ts.TypeFlags.Conditional ? '[conditional]' : ''}`).join(',')}`);
}
