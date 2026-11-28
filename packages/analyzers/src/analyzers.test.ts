import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyse, fill, javaForClassVersion, looksLikeText, parseLog, RULES } from "./index.ts";

const fixture = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "../fixtures", name), "utf8");

/** Paper's latest.log format, one line per message. */
const paper = (...lines: string[]) => lines.join("\n");
const P = (level: string, msg: string, thread = "Server thread") =>
  `[12:00:00] [${thread}/${level}]: ${msg}`;

const find = (text: string, rule: string) => analyse(text).findings.filter((f) => f.rule === rule);
const one = (text: string, rule: string) => {
  const found = find(text, rule);
  expect(found, `${rule} should match once`).toHaveLength(1);
  // biome-ignore lint/style/noNonNullAssertion: checked just above
  return found[0]!;
};

describe("the parser", () => {
  it("reads every header format", () => {
    const log = parseLog(
      [
        "[12:00:00 INFO]: [Vault] Enabling Vault v1.7.3",
        "[12:00:01] [Server thread/WARN]: Something odd",
        "[12:00:02] [main/INFO] [minecraft/DedicatedServer]: Starting minecraft server version 1.20.1",
        "[27Nov2026 12:00:03.123] [main/ERROR] [net.minecraftforge.fml.loading.ModSorter/LOADING]: Missing",
        "[2026-11-27 12:00:04] [Server thread/INFO]: With a date",
        "[12:00:05] [main/INFO] (FabricLoader/GameProvider) Loading Minecraft 1.21.1 with Fabric Loader 0.16.10",
        "\u001b[33m[12:00:06 WARN]: Coloured\u001b[0m",
      ].join("\n"),
    );
    expect(log.entries.map((e) => [e.time, e.level, e.thread, e.logger, e.message])).toEqual([
      ["12:00:00", "info", undefined, undefined, "[Vault] Enabling Vault v1.7.3"],
      ["12:00:01", "warn", "Server thread", undefined, "Something odd"],
      [
        "12:00:02",
        "info",
        "main",
        "minecraft/DedicatedServer",
        "Starting minecraft server version 1.20.1",
      ],
      [
        "12:00:03.123",
        "error",
        "main",
        "net.minecraftforge.fml.loading.ModSorter/LOADING",
        "Missing",
      ],
      ["12:00:04", "info", "Server thread", undefined, "With a date"],
      [
        "12:00:05",
        "info",
        "main",
        "FabricLoader/GameProvider",
        "Loading Minecraft 1.21.1 with Fabric Loader 0.16.10",
      ],
      ["12:00:06", "warn", undefined, undefined, "Coloured"],
    ]);
  });

  it("groups a stack trace under the line that started it", () => {
    const log = parseLog(
      paper(
        P("ERROR", "Error occurred while enabling Foo v1.0 (Is it up to date?)"),
        "java.lang.NullPointerException: boom",
        "\tat com.example.foo.Foo.onEnable(Foo.java:10) ~[Foo-1.0.jar:?]",
        "\tat Foo-1.0.jar/com.example.foo.Bar.run(Bar.java:5) ~[Foo-1.0.jar:?]",
        "Caused by: java.lang.IllegalStateException: deeper",
        "\t... 2 more",
        P("INFO", "Next"),
      ),
    );
    expect(log.entries).toHaveLength(2);
    expect(log.entries[0]).toMatchObject({
      start: 1,
      end: 6,
      exception: "java.lang.NullPointerException",
      frames: ["com.example.foo.Foo.onEnable", "com.example.foo.Bar.run"],
    });
    expect(log.lines.map((l) => l.entry)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it("reads a crash report, its system details and Fabric's mod list", () => {
    const { crash, kind } = parseLog(fixture("fabric-crash.txt"));
    expect(kind).toBe("crash-report");
    expect(crash?.description).toBe("Initializing game");
    expect(crash?.exception).toBe("java.lang.RuntimeException");
    expect(crash?.details["Minecraft Version"]).toBe("1.21.1");
    expect(crash?.details["Java Version"]).toBe("21.0.5, Eclipse Adoptium");
    expect(crash?.mods.map((m) => m.id)).toEqual([
      "fabric-api",
      "fabricloader",
      "java",
      "lithium",
      "lithiumplus",
      "minecraft",
      "ferritecore",
    ]);
  });

  it("reads Forge's mod list from a crash report", () => {
    const { crash } = parseLog(
      [
        "---- Minecraft Crash Report ----",
        "Description: Mod loading error has occurred",
        "",
        "java.lang.Exception: Mod Loading has failed",
        "",
        "-- System Details --",
        "Details:",
        "\tMinecraft Version: 1.20.1",
        "\tMod List: ",
        "\t\tforge-1.20.1-47.3.0-universal.jar               |Forge                         |forge                         |47.3.0              |DONE      |Manifest: NOSIGNATURE",
        "\t\tjei-1.20.1-forge-15.20.0.106.jar                 |Just Enough Items             |jei                           |15.20.0.106         |DONE      |Manifest: NOSIGNATURE",
      ].join("\n"),
    );
    expect(crash?.mods).toEqual([
      { id: "forge", name: "Forge", version: "47.3.0" },
      { id: "jei", name: "Just Enough Items", version: "15.20.0.106" },
    ]);
  });

  it("tells text from binary", () => {
    expect(looksLikeText("[12:00:00 INFO]: hello\n")).toBe(true);
    expect(looksLikeText("PK\u0003\u0004\u0000\u0000binary")).toBe(false);
  });
});

describe("the summary", () => {
  it("reads Paper's software, versions, plugins, startup and mode", () => {
    const { summary } = analyse(fixture("paper-full.log"));
    expect(summary).toMatchObject({
      software: "Paper",
      softwareVersion: "1.21.4-212-ver/1.21.4@4f1a2b3",
      minecraft: "1.21.4",
      java: "21.0.5",
      startup: 11.204,
      mode: "proxy",
      port: "*:25565",
      pluginKind: "plugins",
    });
    expect(summary.plugins.map((p) => p.name)).toEqual([
      "EssentialsX",
      "HoloBoard",
      "LuckPerms",
      "MineRewards",
      "OldWarps",
      "ShopPlus",
      "Skyward",
      "Vault",
      "WorldEdit",
    ]);
  });

  it("reads Spigot's version line", () => {
    const { summary } = analyse(
      P(
        "INFO",
        "This server is running CraftBukkit version 4226-Spigot-146439e-2889b3a (MC: 1.20.4) (Implementing API version 1.20.4-R0.1-SNAPSHOT)",
      ),
    );
    expect(summary).toMatchObject({
      software: "Spigot",
      softwareVersion: "4226-Spigot-146439e-2889b3a",
      minecraft: "1.20.4",
    });
  });

  it("reads Fabric's loader line and mod list", () => {
    const { summary } = analyse(fixture("fabric-mixin.log"));
    expect(summary).toMatchObject({
      software: "Fabric",
      softwareVersion: "0.16.10",
      minecraft: "1.21.1",
      pluginKind: "mods",
    });
    expect(summary.plugins.map((p) => p.name)).toEqual([
      "fabric-api",
      "ferritecore",
      "lithium",
      "lithiumplus",
    ]);
  });

  it("reads Velocity", () => {
    const { summary } = analyse(fixture("velocity.log"));
    expect(summary).toMatchObject({
      software: "Velocity",
      softwareVersion: "3.4.0-SNAPSHOT",
      startup: 2.31,
      mode: "offline",
    });
    expect(summary.plugins).toEqual([{ name: "luckperms", version: "5.4.145" }]);
  });

  it("reads a crash report's Minecraft and Java", () => {
    const { summary } = analyse(fixture("fabric-crash.txt"));
    expect(summary).toMatchObject({ software: "Fabric", minecraft: "1.21.1", java: "21.0.5" });
  });
});

describe("the rule engine", () => {
  it("fills {vars} and tidies the gaps", () => {
    expect(fill("{a} needs {b}.", { a: "Foo", b: "Bar" })).toBe("Foo needs Bar.");
    expect(fill("Froze{blame}.", {})).toBe("Froze.");
  });
  it("has at least 25 rules, each with an id, words, a fix and unique ids", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(r.title, r.id).toBeTruthy();
      expect(r.explain, r.id).toBeTruthy();
      expect(r.fix.length, r.id).toBeGreaterThan(0);
    }
  });
  it("maps class file versions to Java", () => {
    expect([52, 61, 65, 69].map(javaForClassVersion)).toEqual([8, 17, 21, 25]);
  });
});

describe("the rules", () => {
  it("java-class-version: names the plugin and the Java it needs", () => {
    const text = paper(
      P("ERROR", "Could not load 'plugins/Skyward-0.9.2.jar' in folder 'plugins'"),
      "java.lang.UnsupportedClassVersionError: dev/example/skyward/SkywardPlugin has been compiled by a more recent version of the Java Runtime (class file version 69.0), this version of the Java Runtime only recognizes class file versions up to 65.0",
      "\tat java.base/java.lang.ClassLoader.defineClass1(Native Method)",
    );
    const f = one(text, "java-class-version");
    expect(f.title).toBe("Skyward needs Java 25, but the server runs Java 21");
    expect(f.severity).toBe("error");
    // The more exact rule wins over the generic "didn't load".
    expect(find(text, "plugin-load-failed")).toHaveLength(0);
  });

  it("java-class-version: the server jar itself on old Java", () => {
    const f = one(
      [
        "Error: LinkageError occurred while loading main class io.papermc.paperclip.Main",
        "\tjava.lang.UnsupportedClassVersionError: io/papermc/paperclip/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 52.0",
      ].join("\n"),
      "java-class-version",
    );
    expect(f.title).toBe("The server jar needs Java 21, but the server runs Java 8");
  });

  it("plugin-missing-dependency: Paper's modern loader", () => {
    const f = one(fixture("paper-full.log"), "plugin-missing-dependency");
    expect(f.title).toBe("ShopPlus needs PlaceholderAPI and Citizens, which aren't installed");
  });

  it("plugin-missing-dependency: Bukkit's legacy message", () => {
    const f = one(
      paper(
        P("ERROR", "Could not load 'plugins/Jobs.jar' in folder 'plugins'"),
        "org.bukkit.plugin.UnknownDependencyException: Unknown dependency Vault. Please download and install Vault to run this plugin.",
        "\tat org.bukkit.plugin.SimplePluginManager.loadPlugins(SimplePluginManager.java:286)",
      ),
      "plugin-missing-dependency",
    );
    expect(f.title).toBe("Jobs needs Vault, which isn't installed");
    expect(
      find(
        paper(
          P("ERROR", "Could not load 'plugins/Jobs.jar' in folder 'plugins'"),
          "org.bukkit.plugin.UnknownDependencyException: Unknown dependency Vault. Please download and install Vault to run this plugin.",
        ),
        "plugin-load-failed",
      ),
    ).toHaveLength(0);
  });

  it("port-bind-failed: reads the cause and the port", () => {
    const f = one(
      paper(
        P("INFO", "Starting Minecraft server on *:25565"),
        P("WARN", "**** FAILED TO BIND TO PORT!"),
        P(
          "WARN",
          "The exception was: io.netty.channel.unix.Errors$NativeIoException: bind(..) failed: Address already in use",
        ),
        P("WARN", "Perhaps a server is already running on that port?"),
      ),
      "port-bind-failed",
    );
    expect(f.title).toBe("The server couldn't open port 25565");
    expect(f.explanation).toContain("another copy of this server");
    // The specific rule covers it, so the generic one stays quiet.
    expect(
      find(
        paper(
          P("WARN", "**** FAILED TO BIND TO PORT!"),
          P("WARN", "The exception was: java.net.BindException: Address already in use"),
        ),
        "address-in-use",
      ),
    ).toHaveLength(0);
  });

  it("port-bind-failed: Velocity's Can't bind", () => {
    const f = one(fixture("velocity.log"), "port-bind-failed");
    expect(f.title).toBe("The server couldn't open port 25577");
  });

  it("address-in-use: a bare BindException", () => {
    const f = one(
      paper(
        P("ERROR", "Exception while starting the web map"),
        "java.net.BindException: Address already in use",
        "\tat java.base/sun.nio.ch.Net.bind0(Native Method)",
      ),
      "address-in-use",
    );
    expect(f.severity).toBe("error");
  });

  it("cant-keep-up: counts and finds the worst", () => {
    const f = one(
      paper(
        P("WARN", "Can't keep up! Is the server overloaded? Running 2843ms or 56 ticks behind"),
        P("WARN", "Can't keep up! Is the server overloaded? Running 7120ms or 142 ticks behind"),
        P(
          "WARN",
          "Can't keep up! Did the system time change, or is the server overloaded? Running 5012ms behind, skipping 100 tick(s)",
        ),
      ),
      "cant-keep-up",
    );
    expect(f.title).toBe("The server fell behind 3 times, by up to 7.1s (142 ticks)");
    expect(f.lines).toEqual([1, 2, 3]);
  });

  it("outdated-build: Paper's version check and Spigot's", () => {
    expect(one(fixture("paper-full.log"), "outdated-build").title).toBe(
      "Paper is out of date: 14 builds behind",
    );
    expect(
      one(
        "*** Error, this build is outdated ***\n*** Please download a new build as per instructions from https://www.spigotmc.org/go/outdated-spigot ***",
        "outdated-build",
      ).title,
    ).toBe("The server is out of date");
  });

  it("out-of-memory: heap and threads", () => {
    const heap = one(
      paper(
        P("ERROR", "Encountered an unexpected exception"),
        "java.lang.OutOfMemoryError: Java heap space",
      ),
      "out-of-memory",
    );
    expect(heap.title).toBe("Java ran out of memory (Java heap space)");
    expect(heap.explanation).toContain("-Xmx");
    const threads = one(
      "java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached",
      "out-of-memory",
    );
    expect(threads.explanation).toContain("thread");
  });

  it("invalid-plugin-yml: Bukkit's exception and Paper's message", () => {
    const f = one(
      paper(
        P("ERROR", "Could not load 'plugins/SomeMod-1.0.jar' in folder 'plugins'"),
        "org.bukkit.plugin.InvalidDescriptionException: Invalid plugin.yml",
        "\tat org.bukkit.plugin.java.JavaPluginLoader.getPluginDescription(JavaPluginLoader.java:174)",
        "Caused by: java.io.FileNotFoundException: Jar does not contain plugin.yml",
      ),
      "invalid-plugin-yml",
    );
    expect(f.title).toBe("SomeMod has a plugin.yml the server can't read");
    const paperMsg = one(
      P(
        "ERROR",
        "[DirectoryProviderSource] Error loading plugin: plugins/sodium-fabric-0.6.jar does not contain a plugin.yml or paper-plugin.yml! Could not determine plugin type, cannot load a plugin from it!",
      ),
      "invalid-plugin-yml",
    );
    expect(paperMsg.title).toBe("sodium-fabric has a plugin.yml the server can't read");
  });

  it("ambiguous-plugin-name: both quote styles", () => {
    expect(
      one(
        P(
          "WARN",
          "Ambiguous plugin name `Essentials' for files `plugins/EssentialsX-2.20.1.jar' and `plugins/Essentials-2.19.jar' in `plugins'",
        ),
        "ambiguous-plugin-name",
      ).title,
    ).toBe("Two jars are both called Essentials");
    expect(
      one(
        P(
          "ERROR",
          "Ambiguous plugin name 'Essentials' for files 'plugins/a.jar' and 'plugins/b.jar' in 'plugins'",
        ),
        "ambiguous-plugin-name",
      ).explanation,
    ).toContain("plugins/a.jar");
  });

  it("plugin-load-failed: any other reason", () => {
    const f = one(
      paper(
        P("ERROR", "Could not load plugin 'Broken-2.0.jar' in folder 'plugins'"),
        "java.util.zip.ZipException: zip END header not found",
        "\tat java.base/java.util.zip.ZipFile$Source.findEND(ZipFile.java:1645)",
      ),
      "plugin-load-failed",
    );
    expect(f.title).toBe("Broken didn't load");
    expect(f.explanation).toContain("ZipException: zip END header not found");
  });

  it("plugin-enable-error: names the plugin and its cause", () => {
    const f = one(fixture("paper-full.log"), "plugin-enable-error");
    expect(f.title).toBe("HoloBoard failed to enable");
    expect(f.explanation).toContain("NullPointerException");
  });

  it("plugin-task-exception: async and sync tasks, counted", () => {
    const f = one(fixture("paper-full.log"), "plugin-task-exception");
    expect(f.title).toBe("MineRewards's scheduled task failed 3 times");
    const sync = one(
      paper(
        P("WARN", "[Foo] Task #12 for Foo v1.0 generated an exception"),
        "java.lang.NullPointerException",
      ),
      "plugin-task-exception",
    );
    expect(sync.title).toBe("Foo's scheduled task failed once");
  });

  it("plugin-event-exception", () => {
    expect(one(fixture("paper-full.log"), "plugin-event-exception").title).toBe(
      "MineRewards failed handling PlayerJoinEvent",
    );
  });

  it("watchdog: blames the plugin in the Server thread's dump, past its database driver", () => {
    const f = one(fixture("paper-full.log"), "watchdog");
    expect(f.title).toBe("The server froze, most likely in MineRewards");
    expect(f.vars.frame).toBe(
      "dev.example.minerewards.libs.mysql.cj.protocol.ReadAheadInputStream.fill",
    );
  });

  it("watchdog: only the server's code", () => {
    const f = one(
      paper(
        P(
          "ERROR",
          "The server has stopped responding! This is (probably) not a Spigot bug.",
          "Spigot Watchdog Thread",
        ),
        P("ERROR", "Current Thread: Server thread", "Spigot Watchdog Thread"),
        P(
          "ERROR",
          "\t\tnet.minecraft.world.level.chunk.storage.RegionFile.write(RegionFile.java:200)",
          "Spigot Watchdog Thread",
        ),
      ),
      "watchdog",
    );
    expect(f.title).toBe("The server froze");
  });

  it("offline-mode: a warning alone, a note behind a proxy", () => {
    const alone = one(
      paper(
        P("WARN", "**** SERVER IS RUNNING IN OFFLINE/INSECURE MODE!"),
        P("WARN", "The server will make no attempt to authenticate usernames. Beware."),
        P(
          "WARN",
          "While this makes the game possible to play without internet access, it also opens up the ability for hackers to connect with any username they choose.",
        ),
      ),
      "offline-mode",
    );
    expect(alone).toMatchObject({ severity: "warning", title: "The server is in offline mode" });
    expect(one(fixture("paper-full.log"), "offline-mode")).toMatchObject({
      severity: "info",
      title: "Offline mode, behind a proxy",
    });
  });

  it("legacy-material", () => {
    const f = one(fixture("paper-full.log"), "legacy-material");
    expect(f.title).toBe("OldWarps is a legacy plugin");
    expect(f.lines).toHaveLength(2);
  });

  it("mixin-apply-failed: Fabric's fork", () => {
    const f = one(fixture("fabric-mixin.log"), "mixin-apply-failed");
    expect(f.title).toBe("A mixin from lithiumplus couldn't be applied");
    expect(f.explanation).toContain("world.ServerWorldMixin");
  });

  it("mixin-apply-failed: in a crash report, which it then explains", () => {
    const a = analyse(fixture("fabric-crash.txt"));
    expect(a.findings.map((f) => f.title)).toEqual([
      "A mixin from lithiumplus couldn't be applied",
    ]);
    expect(a.errors.map((g) => g.name)).toEqual(["lithiumplus"]);
  });

  it("mixin-apply-failed: upstream Mixin", () => {
    const f = one(
      "[10:00:00] [main/ERROR]: Mixin apply failed carpet.mixins.json:ServerLevel_tickMixin -> net.minecraft.server.level.ServerLevel: org.spongepowered.asm.mixin.injection.throwables.InvalidInjectionException Critical injection failure",
      "mixin-apply-failed",
    );
    expect(f.title).toBe("A mixin from carpet couldn't be applied");
  });

  it("fabric-missing-dependency", () => {
    const f = one(
      [
        "[10:00:00] [main/ERROR]: Incompatible mods found!",
        "net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the game or each other!",
        "A potential solution has been determined, this may resolve your problem:",
        "\t - Install fabric-api, version 0.92.0 or later.",
        "More details:",
        "\t - Mod 'Iris' (iris) 1.8.0 requires version 0.92.0 or later of fabric-api, which is missing!",
        "\t - Mod 'Sodium Extra' (sodium-extra) 0.6.0 requires any version of sodium, which is missing!",
      ].join("\n"),
      "fabric-missing-dependency",
    );
    expect(f.title).toBe(
      "Iris and Sodium Extra need fabric-api (0.92.0 or later) and sodium, which aren't installed",
    );
  });

  it("forge-missing-dependency", () => {
    const f = one(
      [
        "[27Nov2026 10:00:00.000] [main/ERROR] [net.minecraftforge.fml.loading.ModSorter/LOADING]: Missing or unsupported mandatory dependencies:",
        "\tMod ID: 'geckolib', Requested by: 'mowziesmobs', Expected range: '[4.4.9,)', Actual version: '[MISSING]'",
      ].join("\n"),
      "forge-missing-dependency",
    );
    expect(f.title).toBe("mowziesmobs needs geckolib, which isn't installed");
  });

  it("eula", () => {
    expect(one(fixture("vanilla-eula.log"), "eula").title).toBe("The EULA hasn't been accepted");
  });

  it("failed-to-verify-username: names the players", () => {
    const f = one(
      paper(
        P(
          "ERROR",
          "Username 'Notch' tried to join with an invalid session",
          "User Authenticator #2",
        ),
        P("INFO", "Disconnecting Notch (/198.51.100.7:52011): Failed to verify username!"),
        P(
          "INFO",
          "Disconnecting com.mojang.authlib.GameProfile@1a2b3c[id=<null>,name=jeb_,properties={},legacy=false] (/198.51.100.8:40000): Failed to verify username!",
        ),
      ),
      "failed-to-verify-username",
    );
    expect(f.title).toBe("2 players couldn't be verified");
    expect(f.explanation).toContain("Notch and jeb_");
  });

  it("failed-to-verify-username: Mojang down", () => {
    expect(
      one(
        P(
          "ERROR",
          "Couldn't verify username because servers are unavailable",
          "User Authenticator #1",
        ),
        "failed-to-verify-username",
      ).title,
    ).toBe("Mojang's login servers didn't answer");
  });

  it("world-corruption: chunks and level.dat", () => {
    const chunks = one(
      paper(
        P(
          "ERROR",
          "Chunk file at [12, -4] is in the wrong location; relocating. (Expected [12, -4], got [0, 0])",
        ),
        P("WARN", "Region file world/region/r.0.-1.mca has truncated header: 4096"),
        P("ERROR", "Failed to read chunk [3, 7]"),
      ),
      "world-corruption",
    );
    expect(chunks).toMatchObject({ severity: "warning", title: "2 chunks couldn't be read" });
    const level = one(
      P("ERROR", "Failed to load world data from world/level.dat", "main"),
      "world-corruption",
    );
    expect(level).toMatchObject({
      severity: "error",
      title: "The world's level.dat couldn't be read",
    });
  });

  it("moved-too-quickly: a note with the players", () => {
    const f = one(fixture("paper-full.log"), "moved-too-quickly");
    expect(f).toMatchObject({ severity: "info", title: '"Moved too quickly" 2 times' });
    expect(f.explanation).toContain("Steve");
    expect(
      one(P("WARN", "Steve (vehicle of Alex) moved too quickly! 1.0,2.0,3.0"), "moved-too-quickly")
        .explanation,
    ).toContain("Alex");
  });

  it("tick-loop-exception", () => {
    const f = one(
      paper(
        P("ERROR", "Encountered an unexpected exception"),
        "java.lang.IllegalStateException: Tried to tick a removed entity",
        "\tat net.minecraft.server.level.ServerLevel.tickNonPassenger(ServerLevel.java:812)",
        "\tat dev.example.pets.PetTicker.tick(PetTicker.java:30)",
      ),
      "tick-loop-exception",
    );
    expect(f.title).toBe("The server crashed in its tick loop, in dev.example.pets");
  });

  it("crash-ticking: names the entity and where", () => {
    const f = one(
      [
        "---- Minecraft Crash Report ----",
        "Description: Ticking entity",
        "",
        'java.lang.NullPointerException: Cannot invoke "Object.hashCode()" because "key" is null',
        "\tat net.minecraft.world.entity.Mob.tick(Mob.java:300)",
        "",
        "-- Entity being ticked --",
        "Details:",
        "\tEntity Type: minecraft:villager (net.minecraft.world.entity.npc.Villager)",
        "\tEntity's Exact location: 104.50, 64.00, -220.30",
        "",
        "-- System Details --",
        "Details:",
        "\tMinecraft Version: 1.21.4",
      ].join("\n"),
      "crash-ticking",
    );
    expect(f.title).toBe("The game crashed while ticking the entity minecraft:villager");
    expect(f.explanation).toContain("104.50, 64.00, -220.30");
    expect(
      find("---- Minecraft Crash Report ----\nDescription: Ticking entity", "crash-report"),
    ).toHaveLength(0);
  });

  it("crash-report: any other crash", () => {
    const f = one(
      [
        "---- Minecraft Crash Report ----",
        "Description: Exception generating new chunk",
        "",
        "java.lang.ArrayIndexOutOfBoundsException: Index 16 out of bounds for length 16",
      ].join("\n"),
      "crash-report",
    );
    expect(f.title).toBe("Crash: Exception generating new chunk");
  });

  it("proxy-forwarding-mismatch: each end's message", () => {
    expect(one(fixture("paper-full.log"), "proxy-forwarding-mismatch").title).toBe(
      "Players reached the server without going through Velocity",
    );
    expect(
      one(
        P("INFO", "Disconnecting Steve (/10.0.0.2:5555): Unable to verify player details"),
        "proxy-forwarding-mismatch",
      ).title,
    ).toBe("Velocity's forwarding secret doesn't match");
    expect(
      one(
        P(
          "INFO",
          "Disconnecting /10.0.0.2:5555: If you wish to use IP forwarding, please enable it in your BungeeCord config as well!",
        ),
        "proxy-forwarding-mismatch",
      ).title,
    ).toBe("BungeeCord forwarding is only on at one end");
    expect(
      one(
        "[12:00:00 INFO]: [connected player] Steve (/10.0.0.2:5555) has disconnected: Your server did not send a forwarding request to the proxy. Make sure the server is configured for Velocity forwarding.",
        "proxy-forwarding-mismatch",
      ).title,
    ).toBe("The server didn't answer Velocity's forwarding");
  });

  it("velocity-backend-online-mode", () => {
    expect(one(fixture("velocity.log"), "velocity-backend-online-mode").severity).toBe("error");
  });

  it("velocity-insecure: offline mode and no forwarding", () => {
    const found = find(fixture("velocity.log"), "velocity-insecure").map((f) => f.title);
    expect(found).toEqual(["Velocity is in offline mode", "Velocity isn't forwarding players"]);
  });

  it("plugin-wrong-version: CraftBukkit's versioned packages", () => {
    const f = one(
      paper(
        P("ERROR", "Error occurred while enabling OldNPCs v3.1 (Is it up to date?)"),
        "java.lang.NoClassDefFoundError: org/bukkit/craftbukkit/v1_20_R3/entity/CraftPlayer",
        "\tat dev.example.oldnpcs.NPCManager.spawn(NPCManager.java:40)",
      ),
      "plugin-wrong-version",
    );
    expect(f.title).toBe("OldNPCs was built for another Minecraft version");
  });

  it("nag-system-out", () => {
    expect(one(fixture("paper-full.log"), "nag-system-out").title).toBe(
      "Skyward writes to the console directly",
    );
  });
});

describe("a full Paper log, end to end", () => {
  const a = analyse(fixture("paper-full.log"));

  it("finds exactly the problems in it, worst first", () => {
    expect(a.findings.map((f) => [f.severity, f.rule])).toEqual([
      ["error", "plugin-missing-dependency"],
      ["error", "plugin-enable-error"],
      ["error", "plugin-event-exception"],
      ["error", "proxy-forwarding-mismatch"],
      ["error", "plugin-task-exception"],
      ["error", "watchdog"],
      ["warning", "legacy-material"],
      ["warning", "outdated-build"],
      ["info", "offline-mode"],
      ["info", "nag-system-out"],
      ["info", "moved-too-quickly"],
    ]);
  });

  it("groups every error by plugin, the server's own last", () => {
    expect(a.errors.map((g) => [g.name, g.entries.length])).toEqual([
      ["MineRewards", 5],
      ["HoloBoard", 1],
      ["ShopPlus", 1],
    ]);
    expect(a.errors[0]?.exceptions[0]).toEqual({
      name: "SQLTransientConnectionException",
      count: 3,
    });
  });

  it("shows the matching lines with their stack traces", () => {
    const f = a.findings.find((x) => x.rule === "plugin-enable-error");
    expect(f?.context.length).toBe(6);
    expect(a.log.lines[(f?.lines[0] ?? 0) - 1]?.text).toContain(
      "Error occurred while enabling HoloBoard",
    );
  });

  it("is recognised as a log", () => {
    expect(a.recognised).toBe(true);
    expect(analyse("just some notes\nnothing here").recognised).toBe(false);
  });

  it("stays quick at 50,000 lines", () => {
    const big = Array.from({ length: 350 }, () => fixture("paper-full.log")).join("");
    const start = performance.now();
    const result = analyse(big);
    expect(result.log.lines.length).toBeGreaterThan(50_000);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
