import { describe, expect, it } from "vitest";
import {
  advise,
  aikarFlags,
  dockerCompose,
  type FlagOptions,
  forgeUsesArgsFile,
  jvmFlags,
  memoryValue,
  parseMcVersion,
  pterodactylCommand,
  pterodactylPanelMb,
  requiredJava,
  startBat,
  startSh,
  VELOCITY_FLAGS,
  zgcFlags,
} from "./index.ts";

const base: FlagOptions = {
  ramGb: 10,
  software: "paper",
  java: 25,
  gc: "g1",
  mcVersion: "",
  jar: "",
  nogui: true,
  restart: false,
};
const o = (patch: Partial<FlagOptions>): FlagOptions => ({ ...base, ...patch });
const ids = (opts: FlagOptions, totalGb?: number, container = false) =>
  advise(opts, { totalGb, container }).map((a) => a.id);

// PaperMC's command, word for word: https://docs.papermc.io/paper/aikars-flags
const PAPER_DOCS =
  "java -Xms10G -Xmx10G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar paper.jar --nogui";

describe("Aikar's flags", () => {
  it("match PaperMC's page exactly", () => {
    expect(startSh(base).split("\n").at(-2)).toBe(PAPER_DOCS);
  });
  it("switch to the larger-heap values only above 12GB", () => {
    const at12 = aikarFlags(12 * 1024);
    expect(at12).toContain("-XX:G1HeapRegionSize=8M");
    const over = aikarFlags(12 * 1024 + 512);
    for (const f of [
      "-XX:G1NewSizePercent=40",
      "-XX:G1MaxNewSizePercent=50",
      "-XX:G1HeapRegionSize=16M",
      "-XX:G1ReservePercent=15",
      "-XX:InitiatingHeapOccupancyPercent=20",
    ])
      expect(over).toContain(f);
    expect(over).toHaveLength(at12.length);
  });
  it("set Xms equal to Xmx", () => {
    expect(jvmFlags(o({ ramGb: 6.5 })).slice(0, 2)).toEqual(["-Xms6656M", "-Xmx6656M"]);
    expect(memoryValue(8192)).toBe("8G");
  });
});

describe("generational ZGC", () => {
  it("needs ZGenerational on Java 21 only", () => {
    expect(zgcFlags(21)?.slice(0, 2)).toEqual(["-XX:+UseZGC", "-XX:+ZGenerational"]);
    expect(zgcFlags(25)).not.toContain("-XX:+ZGenerational");
    expect(zgcFlags(25)?.[0]).toBe("-XX:+UseZGC");
  });
  it("isn't available on Java 17, which falls back to G1 with a warning", () => {
    expect(zgcFlags(17)).toBeNull();
    const opts = o({ gc: "zgc", java: 17 });
    expect(jvmFlags(opts)).toContain("-XX:+UseG1GC");
    expect(ids(opts)).toContain("zgc-java17");
  });
  it("warns on small heaps", () => {
    expect(ids(o({ gc: "zgc", ramGb: 4 }))).toContain("zgc-small");
    expect(ids(o({ gc: "zgc", ramGb: 16 }))).not.toContain("zgc-small");
  });
});

describe("proxies", () => {
  it("use Velocity's flags and no nogui", () => {
    const opts = o({ software: "velocity", ramGb: 1, gc: "zgc" });
    expect(jvmFlags(opts)).toEqual(["-Xms1G", "-Xmx1G", ...VELOCITY_FLAGS]);
    expect(startSh(opts)).toContain(
      "java -Xms1G -Xmx1G -XX:+UseG1GC -XX:G1HeapRegionSize=4M -XX:+UnlockExperimentalVMOptions -XX:+ParallelRefProcEnabled -XX:+AlwaysPreTouch -XX:MaxInlineLevel=15 -jar velocity.jar\n",
    );
  });
  it("warn about too much memory", () => {
    expect(ids(o({ software: "bungeecord", ramGb: 8 }))).toContain("proxy-ram");
    expect(ids(o({ software: "velocity", ramGb: 2 }))).not.toContain("proxy-ram");
  });
});

describe("Java versions", () => {
  it("parse release numbers", () => {
    expect(parseMcVersion("1.21.4")).toEqual([1, 21, 4]);
    expect(parseMcVersion("26.1")).toEqual([26, 1, 0]);
    expect(parseMcVersion("1.22")).toBeNull();
    expect(parseMcVersion("24w14a")).toBeNull();
    expect(parseMcVersion("2.1")).toBeNull();
  });
  it("follow Mojang's version manifest", () => {
    const need = (v: string) => requiredJava(parseMcVersion(v) ?? [0, 0, 0]);
    expect(need("1.16.5")).toBe(8);
    expect(need("1.17.1")).toBe(16);
    expect(need("1.18")).toBe(17);
    expect(need("1.20.4")).toBe(17);
    expect(need("1.20.5")).toBe(21);
    expect(need("1.21.11")).toBe(21);
    expect(need("26.1")).toBe(25);
    expect(need("26.3")).toBe(25);
  });
  it("warn when Java is too old", () => {
    expect(ids(o({ mcVersion: "1.21.4", java: 17 }))).toContain("java-too-old");
    expect(ids(o({ mcVersion: "1.21.4", java: 21 }))).not.toContain("java-too-old");
    expect(ids(o({ mcVersion: "26.1", java: 21 }))).toContain("java-too-old");
    expect(ids(o({ mcVersion: "1.20.4", java: 17 }))).toContain("java-paper-21");
  });
});

describe("memory", () => {
  it("warns at the ends of the range", () => {
    expect(ids(o({ ramGb: 1 }))).toContain("ram-low");
    expect(ids(o({ ramGb: 32 }))).toContain("ram-high");
    expect(ids(o({ ramGb: 10 }))).toEqual([]);
  });
  it("warns when the heap leaves too little of the machine", () => {
    expect(ids(o({ ramGb: 8 }), 8)).toContain("over-total");
    expect(ids(o({ ramGb: 7.5 }), 8)).toContain("headroom");
    expect(ids(o({ ramGb: 6.5 }), 8)).not.toContain("headroom");
    // A container needs more.
    expect(ids(o({ ramGb: 6.5 }), 8, true)).toContain("headroom");
    const fix = advise(o({ ramGb: 7.5 }), { totalGb: 8, container: true })[0]?.fixRamGb;
    expect(fix).toBe(6.0);
  });
});

describe("scripts", () => {
  it("writes a restart loop", () => {
    const sh = startSh(o({ restart: true }));
    expect(sh.startsWith("#!/usr/bin/env sh\n")).toBe(true);
    expect(sh).toContain("while true; do\n  java ");
    const bat = startBat(o({ restart: true }));
    expect(bat).toContain(":start\r\njava ");
    expect(bat).toContain("goto start");
    expect(startBat(base)).toContain("\r\npause\r\n");
  });
  it("quotes awkward jar names", () => {
    expect(startSh(o({ jar: "my server.jar" }))).toContain("-jar 'my server.jar' --nogui");
    expect(startBat(o({ jar: "my server.jar" }))).toContain('-jar "my server.jar" --nogui');
  });
  it("writes vanilla's nogui and leaves it out when asked", () => {
    expect(startSh(o({ software: "vanilla" }))).toContain("-jar server.jar nogui\n");
    expect(startSh(o({ nogui: false }))).toContain("-jar paper.jar\n");
  });
  it("starts modern Forge through run.sh and user_jvm_args.txt", () => {
    const forge = o({ software: "forge", mcVersion: "1.21.1", java: 21 });
    expect(forgeUsesArgsFile(forge)).toBe(true);
    expect(startSh(forge)).toContain("cat > user_jvm_args.txt <<'EOF'\n-Xms10G -Xmx10G");
    expect(startSh(forge)).toContain("./run.sh nogui");
    expect(startBat(forge)).toContain(">user_jvm_args.txt echo -Xms10G");
    expect(forgeUsesArgsFile(o({ software: "forge", mcVersion: "1.12.2" }))).toBe(false);
  });
});

describe("Pterodactyl", () => {
  it("sizes the heap from SERVER_MEMORY", () => {
    const cmd = pterodactylCommand(base);
    expect(cmd).toMatch(
      /^java -Xms\$\(\(\{\{SERVER_MEMORY\}\}\*85\/100\)\)M -Xmx\$\(\(\{\{SERVER_MEMORY\}\}\*85\/100\)\)M -XX:\+UseG1GC /,
    );
    expect(cmd).toContain(
      "-Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}} --nogui",
    );
    expect(pterodactylPanelMb(base)).toBe(Math.ceil((10240 * 100) / 85));
  });
  it("gives a proxy half", () => {
    const cmd = pterodactylCommand(o({ software: "velocity", ramGb: 1 }));
    expect(cmd).toContain("-Xmx$(({{SERVER_MEMORY}}/2))M");
    expect(cmd.endsWith("-jar {{SERVER_JARFILE}}")).toBe(true);
  });
});

describe("Docker", () => {
  it("uses the image's Aikar's flags for G1", () => {
    const yml = dockerCompose(o({ mcVersion: "1.21.4", java: 21 }));
    expect(yml).toContain("image: itzg/minecraft-server:java21");
    expect(yml).toContain('EULA: "TRUE"');
    expect(yml).toContain("TYPE: PAPER");
    expect(yml).toContain('VERSION: "1.21.4"');
    expect(yml).toContain("MEMORY: 10G");
    expect(yml).toContain('USE_AIKAR_FLAGS: "true"');
    expect(yml).not.toContain("JVM_XX_OPTS");
  });
  it("passes ZGC through JVM_XX_OPTS", () => {
    const yml = dockerCompose(o({ gc: "zgc", java: 21, ramGb: 16 }));
    expect(yml).toContain('JVM_XX_OPTS: "-XX:+UseZGC -XX:+ZGenerational');
    expect(yml).not.toContain("USE_AIKAR_FLAGS");
  });
  it("uses itzg/mc-proxy for a proxy", () => {
    const yml = dockerCompose(o({ software: "bungeecord", ramGb: 1, restart: true }), 2);
    expect(yml).toContain("image: itzg/mc-proxy:java25");
    expect(yml).toContain("restart: unless-stopped");
    expect(yml).toContain("mem_limit: 2G");
    expect(yml).toContain('"25565:25577"');
    expect(yml).toContain("TYPE: BUNGEECORD # or WATERFALL");
  });
});
