const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const scripts = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) {
  if (m[1].length > 500) scripts.push(m[1]);
}

if (!scripts.length) {
  console.error("ERRO: nenhum script inline encontrado em index.html");
  process.exit(1);
}

let ok = true;
for (let i = 0; i < scripts.length; i++) {
  try {
    new Function(scripts[i]);
    console.log(`index.html script ${i + 1}: OK (${scripts[i].length} chars)`);
  } catch (e) {
    console.error(`index.html script ${i + 1}: ERRO DE SINTAXE — ${e.message}`);
    ok = false;
  }
}

const sjs = path.join(__dirname, "server.js");
if (fs.existsSync(sjs)) {
  try {
    require(sjs + "?check");
  } catch (_) {}
  const { execSync } = require("child_process");
  try {
    execSync(`node --check "${sjs}"`, { stdio: "pipe" });
    console.log("server.js: OK");
  } catch (e) {
    console.error("server.js: ERRO DE SINTAXE");
    ok = false;
  }
}

if (!ok) {
  console.error("\nDeploy BLOQUEADO — corrija os erros acima.");
  process.exit(1);
}
console.log("\nSintaxe verificada com sucesso.");
