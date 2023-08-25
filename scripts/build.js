import fs from "fs";
import { execa } from "execa";

// 需要被打包的模块
let targets = fs
  .readdirSync("packages")
  .filter((target) => fs.statSync(`packages/${target}`).isDirectory());

function build(target) {
  execa("rollup", ["-c", "--environment", `TARGET:${target}`], { stdio: "inherit" });
}

function runParallel(targets, build) {
  for (let target of targets) {
    build(target);
  }
}

runParallel(targets, build);
