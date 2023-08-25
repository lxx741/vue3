import { execa } from "execa";

function build(target) {
  execa("rollup", ["-cw", "--environment", `TARGET:${target}`], { stdio: "inherit" });
}

const target = "runtime-dom";
build(target);
