# Getting Started with Claude Code — A Plain-English Guide

*Written for someone who has never used a terminal or built an app before. No prior technical knowledge assumed.*

You've designed a complete product in this chat. The next phase — turning the prototype into a real, working app — happens in a different tool called **Claude Code**. This guide gets you from "I've only ever used the chat" to "Claude Code is running and ready to build," in plain language.

First, an honest framing: this is a real step up from chatting. Claude Code is a developer tool. You can absolutely do the setup yourself — it takes about 5–10 minutes — but actually *driving the build* over many sessions is involved. Two equally valid paths:

- **Do it yourself.** Follow this guide, then direct Claude Code the way you've directed this chat. You make the product calls; it writes the code.
- **Bring in a developer.** Hand them your four files and have them run Claude Code while you steer the product decisions. The product judgment you've shown is the hard, valuable part — the typing is the easy part.

Either way, here's how it works.

---

## A few words you'll see (decoded)

- **Terminal** — a plain text window where you type commands instead of clicking buttons. It looks intimidating but you'll only need a handful of commands. On a Mac it's an app called "Terminal"; on Windows it's "PowerShell." Both come pre-installed.
- **Repo / repository** — a project folder for your app's code that also tracks every change (so nothing is ever truly lost). The tracking is done by a tool called **Git**.
- **CLAUDE.md** — a plain text file you put in your project folder. Claude Code reads it automatically every time it starts, so it always knows your project. (Your `CLAUDE_Code_Kickoff.md` is built to be this file.)

---

## What you need before you start

1. **A paid Claude plan.** Claude Code is **not** included in the free plan. A **Claude Pro** subscription (the same kind you may already have) covers it; **Max** adds more usage for heavy work. (An Anthropic "Console" / API account also works, but Pro is the simplest.)
2. **Your computer** — Mac, Windows, or Linux all work.
3. **Your four files** — `StyleProfiles.jsx`, `styleprofiles_schema.sql`, `StyleProfiles_Architecture_and_Backlog.md`, and `CLAUDE_Code_Kickoff.md`. Keep them somewhere you can find, like a "StyleProfiles" folder in your Documents.

---

## Step 1 — Install Claude Code

The easiest method today is the "native installer" — one line you paste into your terminal. No other software required.

1. Open the official quickstart page: **https://code.claude.com/docs/en/quickstart**
2. Find the install command for **your operating system** (Mac, Windows, or Linux) and copy it. *(Copying from the page guarantees you get the current, correct command.)*
3. Open your terminal:
   - **Mac:** press `Cmd + Space`, type "Terminal," press Enter.
   - **Windows:** click Start, type "PowerShell," press Enter.
4. Paste the command and press Enter. Wait for it to finish (under a minute).
5. Type `claude --version` and press Enter. If you see a version number, it worked.

> **Prefer something more visual than a black terminal window?** Claude Code also runs inside **VS Code**, a free, friendly code editor — install VS Code first, then add the "Claude Code" extension. Same tool, gentler-looking window. The terminal path above is simpler to install, though.

---

## Step 2 — Sign in

1. In the terminal, type `claude` and press Enter.
2. It will open your web browser to sign in. Log in with your **paid Claude account** and approve access.
3. Back in the terminal, you're connected. (Tip: type `claude doctor` anytime to check everything's healthy.)

---

## Step 3 — Create your project folder and add your files

1. Make a new folder for the project — for example, a folder called `StyleProfiles` in your Documents. (You can do this normally in Finder/File Explorer.)
2. Inside it, make a sub-folder called `docs` and put **three** of your files there: `StyleProfiles.jsx`, `styleprofiles_schema.sql`, and `StyleProfiles_Architecture_and_Backlog.md`.
3. Take the fourth file, `CLAUDE_Code_Kickoff.md`, **rename it to `CLAUDE.md`**, and place it in the **main** `StyleProfiles` folder (not in `docs`). This is the file Claude Code reads automatically.

---

## Step 4 — Start building

1. In the terminal, navigate into your project folder. Type `cd ` (with a space), then drag the `StyleProfiles` folder from Finder/File Explorer onto the terminal window — it fills in the location for you — then press Enter.
   *(`cd` means "change directory," i.e. "go into this folder.")*
2. Type `claude` and press Enter. It starts up **inside your project** and reads your `CLAUDE.md` automatically.
3. Type a first message, in plain English, like:

   > "Read my CLAUDE.md and the three files in the docs folder. Then walk me through the open decisions you need from me before we start Batch 6. Don't write any code yet — just confirm you understand the project and ask me the questions."

That's it. From there you direct it exactly like this chat — it'll ask you the setup questions, then start building the backend step by step.

---

## A few things that will make this go well

- **Let it explain before it builds.** Ask it to show its plan first. You don't need to read the code — you need to confirm the plan matches your intent, which is exactly the judgment you've been using all along.
- **Go one step at a time.** Your kickoff file already tells it to work one ticket at a time. Resist the urge to say "build everything" — small, checked steps are how this stays under control.
- **It can change files on your computer and run commands.** That's the point, but it means you should review what it's about to do rather than approving blindly, especially anything involving deleting files or touching live data. Because your project is a Git repo, mistakes are recoverable — but caution beats cleanup.
- **You'll also set up two outside accounts as you go:** **Supabase** (your database — has a free tier) and later **Stripe** (payments). Claude Code will guide you through connecting them when each batch needs them; you don't need them on day one.
- **The install is the easy part.** The real skill is the back-and-forth of directing the build — and you've been doing that fluently this whole time.

---

## If you get stuck

- Official quickstart & troubleshooting: **https://code.claude.com/docs/en/quickstart**
- In the terminal, `/help` lists what you can do, and `claude doctor` diagnoses install problems.
- And you can always come back to a Claude chat (like this one) to ask "what does this error mean?" or "what should I tell Claude Code to do next?" — using the chat as your strategist and Claude Code as your builder is a great way to work.

You're not starting over — you're handing a finished blueprint to a builder. Everything you've designed is ready to go.
