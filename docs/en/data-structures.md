# Data Structures (Core Data Structure Quick Reference)

> When learning Hermes Agent, the easiest place to get lost isn't too many features Б─■ it's not knowing "where state actually lives." This document consolidates key data structures into a single state map, helping you piece 24 chapters back into a coherent whole.

---

## How to Read This Document

Use it as a "state index page" rather than memorizing from top to bottom:

- If you don't understand a term Б├▓ go to [`glossary.md`](./glossary.md)
- If chapter boundaries are unclear Б├▓ go to [`h00-architecture-overview.md`](./h00-architecture-overview.md)
- If you're confused between `h05` / `h06` / `h07` Б├▓ focus on the "context, session, memory" structure groups
- If you're confused between `h08` / `h17` / `h18` Б├▓ focus on the "skill, tool registry, plugin, MCP" structure groups

---

## Two General Principles to Remember First

### Principle 1: Distinguish "Content State" from "Process State"

- `messages`, memory text, skill text Б├▓ content state
- `turn_count`, todo status, permission decision, fallback chain Б├▓ process state

Many beginners mix these two, making it hard to understand why an agent system needs both message history and control state.

### Principle 2: Distinguish "Persistent State" from "Runtime State"

- session, memory files, cron jobs, persisted configs Б├▓ persistent state
- current tool call, current approval result, current provider fallback choice Б├▓ runtime state

Once this boundary is clear, many "why isn't this just put inside messages" questions answer themselves.

---

## 1. Conversation Main Line Structures

### Message

Purpose: Store a single conversation message.

Minimal shape:

```python
message = {
    "role": "user" | "assistant" | "tool",
    "content": "...",
}
```

In more complete agent loops, it may also contain: structured text blocks, tool call info, tool result info.

Related chapters: `h01`, `h02`, `h05`, `h06`

### Messages

Purpose: Store the message list currently within the context window during the conversation.

Minimal shape:

```python
messages = [message1, message2, message3]
```

It's the agent's most important current working memory, but not a long-term archive.

Related chapters: `h01`, `h05`, `h06`

### ToolCall

Purpose: Describe which tool the model wants to call and with what parameters.

Minimal shape:

```python
tool_call = {
    "id": "call_123",
    "name": "read_file",
    "arguments": {"path": "notes.txt"},
}
```

Its significance is turning "the model's intent" into "a structure code can dispatch."

Related chapters: `h01`, `h02`

### ToolResult

Purpose: Write tool execution results back into the conversation main line.

Minimal shape:

```python
tool_result = {
    "role": "tool",
    "tool_call_id": "call_123",
    "content": "file content...",
}
```

Its key role isn't for the user to see but for the model to continue thinking based on real execution results in the next turn.

Related chapters: `h01`, `h02`

### LoopState

Purpose: Record where the main loop is currently at.

Minimal shape:

```python
loop_state = {
    "iteration": 3,
    "max_iterations": 12,
    "stopped": False,
}
```

It's process state, not business content.

Related chapters: `h01`

---

## 2. Tool System Structures

### ToolSchema

Purpose: Tell the model what this tool is called, what it does, and what input it needs.

Minimal shape:

```python
tool_schema = {
    "name": "write_file",
    "description": "Write text to a file",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
    },
}
```

It's the instruction manual for the model, not code for the handler to directly execute.

Related chapters: `h02`

### ToolHandler

Purpose: The code entry point that actually executes tool logic.

Minimal shape:

```python
def write_file(path: str, content: str) -> str:
    ...
```

Once separated from schema, the tool system becomes easy to extend.

Related chapters: `h02`

### ToolRegistry

Purpose: Centrally register schemas and handlers, dispatching by tool name.

Minimal shape:

```python
registry = {
    "write_file": {
        "schema": tool_schema,
        "handler": write_file,
    }
}
```

Real value: new tools register once; the main loop doesn't need to change.

Related chapters: `h02`, `h17`, `h18`

### Dispatch Map

Purpose: Route tool requests to the corresponding handler by name.

Minimal shape:

```python
dispatch_map = {
    "read_file": read_file,
    "write_file": write_file,
    "bash": run_command,
}
```

Think of it as the registry's core execution surface.

Related chapters: `h02`

---

## 3. Planning and Execution State

### TodoItem

Purpose: Describe a single step in the plan.

Minimal shape:

```python
todo_item = {
    "id": "todo_1",
    "content": "Inspect bridge-docs metadata",
    "status": "in_progress",
}
```

It gives the agent explicit representation of its own work progress.

Related chapters: `h03`

### PlanState

Purpose: Store the currently active todo list.

Minimal shape:

```python
plan_state = {
    "items": [todo_item1, todo_item2],
}
```

Key point: it's agent internal execution state, not a normal external tool result.

Related chapters: `h03`

### Agent-level Tool State

Purpose: Store internal state changes that must be prioritized by the main loop.

Minimal shape:

```python
agent_state = {
    "plan_state": plan_state,
}
```

Its existence explains why `todo` isn't a normal registry tool.

Related chapters: `h03`

---

## 4. Prompt Assembly Structures

### PromptSection

Purpose: Represent an independently manageable fragment of the system prompt.

Minimal shape:

```python
section = {
    "name": "memory",
    "content": "...",
    "priority": 30,
    "enabled": True,
}
```

Its value: prompts are no longer one hard-to-maintain large string.

Related chapters: `h04`

### PromptBuilder

Purpose: Assemble multiple prompt sections by order and conditions.

Minimal shape:

```python
builder = {
    "sections": [section1, section2, section3],
}
```

It gives prompt structure clear boundaries and priorities.

Related chapters: `h04`

### PromptSources

Purpose: Represent where prompt fragments come from.

Most typical sources: personality, memory, skills, context files, tool guidance.

This isn't a fixed class name but a categorization perspective for understanding prompt structure.

Related chapters: `h04`, `h07`, `h08`

---

## 5. Context Compression Structures

### CompressionPolicy

Purpose: Decide when to trigger compression and which messages to protect.

Minimal shape:

```python
policy = {
    "threshold": 0.5,
    "protect_last_n": 8,
}
```

Related chapters: `h05`

### SummaryBlock

Purpose: Replace a segment of earlier raw history with a summary.

Minimal shape:

```python
summary_block = {
    "compressed_turn_ids": [1, 2, 3, 4],
    "summary_text": "Earlier turns established the file layout...",
}
```

It's the core embodiment of "compression is not deleting history."

Related chapters: `h05`

### CompressionResult

Purpose: Represent the new context result after one compression.

Minimal shape:

```python
compression_result = {
    "messages": [...],
    "summary": summary_block,
    "lineage_id": "session_b",
}
```

It typically affects: the currently visible context, session lineage, and subsequent search paths.

Related chapters: `h05`, `h06`

---

## 6. Session Persistence Structures

### SessionRecord

Purpose: Store a persistent record of one session.

Minimal shape:

```python
session_record = {
    "session_id": "sess_123",
    "platform": "cli",
    "messages": [...],
    "created_at": "2026-04-10T10:00:00Z",
}
```

This is the critical bridge from "runtime message list" to "recoverable session record."

Related chapters: `h06`

### SessionLineage

Purpose: Represent parent-child relationships between sessions.

Minimal shape:

```python
session_lineage = {
    "session_id": "sess_new",
    "parent_session_id": "sess_old",
}
```

It lets compressed sessions still trace back to original history.

Related chapters: `h05`, `h06`

### FTS Index Record

Purpose: Support keyword search across historical sessions.

Minimal shape:

```python
fts_record = {
    "session_id": "sess_123",
    "search_text": "tool registry write file prompt builder",
}
```

Not a structure users see directly, but the foundation that makes session search work.

Related chapters: `h06`

---

## 7. Memory and Skill Structures

### MemoryEntry

Purpose: Represent a piece of information worth retaining across sessions.

Minimal shape:

```python
memory_entry = {
    "category": "user_preference",
    "content": "User prefers concise summaries.",
}
```

Hermes' key isn't "can write memory" but "must first judge what's worth writing."

Related chapters: `h07`

### MemoryStore

Purpose: Store long-term memory text, e.g., `MEMORY.md` / `USER.md`.

Minimal shape:

```python
memory_store = {
    "memory_md": "...",
    "user_md": "...",
}
```

Its difference from session: session leans toward history records; memory leans toward refined long-term knowledge.

Related chapters: `h07`

### SkillDescriptor

Purpose: Describe a skill's metadata and body.

Minimal shape:

```python
skill = {
    "name": "code-review",
    "description": "Guide for reviewing patches",
    "content": "...markdown body...",
}
```

Related chapters: `h08`

### SkillInjection

Purpose: Represent how a skill is injected into the current conversation.

Minimal shape:

```python
skill_injection = {
    "role": "user",
    "content": "Apply the following skill...",
}
```

Key point: it's a user message, not a system prompt section.

Related chapters: `h08`

---

## 8. Approval and Recovery Structures

### DangerPattern

Purpose: Describe a matching rule for high-risk operations.

Minimal suВozРз$z{-╝Иэjв²3c&#├3CS3f"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒##FSfff&FccvfS3├6C#s√Cc&fc36fS√F3#f3├f3#√cFV#F#├VR"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#F3fc√cc6S3#3├3f#3┐c#┐&C3┐csvSCfcSV##svS├VSSv6ff&c⌠▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&fF##√c┐6fC#⌠⌠⌠s3┐Sf3cC┐#⌠6&6f6ccf#cv#ssScsV#6FC#├6VfB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#┐┐3#⌠3vFcc├S⌠fC├3v#S6fCV3CfCS&&Ss├FVf6⌠#f#√3fS#3VcCsC▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#cfc##SV3√6f3⌠vcF&S&C├3#6FVCc6S⌠√cc├F#CFccvc├3cv#CcCcc6"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&V&CcFfF6&c⌠├33c6#cV66#C√c#fC┐&6C&&&#⌠fVSV⌠SVc6#sVc⌠3v#C""б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#c├3CCVS⌠CC##fSc⌠f&6C3&6#6F#3⌠ff3&#⌠┐vF#v&VS#┐Cs&b"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&3Svfcs&3S&&SFcF3├f3┐s├cv6C⌠√CFS⌠vf3C&S&√cC⌠s33VF""б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&6cSvVCc&FCFC√3c⌠c3s3ffc⌠├VFFVcS⌠sc├&&#⌠┐v3v#√6#C√V3r"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&#⌠c┐S6cs36fVC√├C#├C3⌠vSV3┐C3s⌠#sC√FC┐C3&SvcscFVF6#S#3V3Cc"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#fVSC3fc√6fc├⌠⌠3┐sc6┐6#⌠C√SVCv#3⌠cSfc┐┐√#&&&&&Sc#r"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&#√cfSS#S#Ff##CF3vSVS6Cs┐├Cs┐vF#Cv3FF#&VFs┐√6f#f3CvcsC⌠c┌"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&c├csV66cSsC⌠⌠├cSvS├F3⌠⌠f#CVCvc√CS&&#S├3V3&&R"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒##&c#6#fVfCF&6Cf&Cf666CC&#fv#├6SFCCC┐┐FSC3#33√R"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&f3#SS√C⌠FS√Ss6f#CVCCffcVC#6CcC┐⌠&363F6⌠#&c3f3⌠▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#SCcv36633cCCfVFSS6SS√F3┐&3C#vC&3S3C⌠&V&6fcc√c⌠⌠v2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#6S├√&V#⌠C3#Cc⌠svC3⌠3C&3√cS3#fFFcsSfCffVc##┐├#√B"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒##c√VC3scsccsS┐SC#⌠⌠V&f#⌠c&#⌠#&#Cv36#VfC3┐&#6V3┐C6CS&F3CvB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&c6V3⌠6CC├3F&cC⌠&C3s#⌠c&cF3√C&&⌠v⌠v6S⌠V3#Scf3&S6f#C2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#┐vFCvcfF6C√FCcsSsCcc┐├f63#SCC⌠┐c3c##S3⌠3C┐C⌠Sv#⌠&#┌"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#c&&VCc3SSC√VV3├Sv#sV6Scss⌠┐vc√##C#&&&F3#cv6fS&f6f▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#63s┐c⌠sS#├S36&#sVFVF#c┐s⌠sv6#SF&#⌠#V√SSF3√S3├VC#6&Sf#├#B"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&&&C36c3c3&#FSS⌠&fFSc#sc⌠sfS3C┐3c⌠c┐3&CsvcC⌠Ss6SFS▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&c┐├S√CscS⌠┐FSs⌠F#C#3C36F6VF333┐&6c#C#√c3┐3&fVF#S#√F3"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#&SvVc┐#vV3&VFf3&S3C√#F66VFCc3FVC##c&6fS6###6c"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#┐&fS⌠6C├6#&3s33fVcS&cC3SSs⌠#S3⌠┐#&###fCF#Sc├6F6f3├Cv┌"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&FS⌠F36c3⌠┐Cv#FfV&#CfSfvFS6VCc├6cfC66fcS┐#6FVcVC3√6&cCr"б&√вф√VDfВ&жB#ё⌠≈рб#vCV3⌠v#&C√VS3c#3V3├3s3cCC#√3v#Ff#c√c√&Vff3┐S#VSs2"б#fcVVC⌠V&#3v3cFV#┐SC⌠CCssFV#3#⌠vfCCv33vFS⌠fVcSvSss├SV6R"б#6Cc√#&Svc┐cCsC#⌠##&S√FC√F&CSC3#F3⌠f#C&S3V3V├f6C┐R"б#3#v#┐###3Ccc&3S6Vf#cs3&&f3├S√├#&F#┐V6VcVSC#vc├#&c3CS""б&V#√3V3√Fss#f#scS6CVcvv63┐F6F3cS#c66C#6&cCFf3├SF3S#⌠""б#⌠3fcc6ffSS#├FV3c6#cS#┐#FcsVC3├&ccFc┐s6SCF6VVCfSc#FSc#┌"б#├V&3S#v#S√fVCFS33#cfF#&&S3SS├6cf&fS6VCc3ffS⌠fS#&S├S├"б#⌠&#C┐#V&fS⌠3#┐#⌠63VSc┐vs⌠6Ff33c√3#√#ScS├S&S⌠ssVfC#√fC┐""б&CVS⌠C√V3ss&VV3v3SfC√S3sSC⌠##&c&⌠c#6SF3fcV#sSC⌠√3S┐┌"б#┐3&S├┐√6VCFc⌠vfCSfV6c┐&FS&6csC6├cVfc┐F3&33F#Fv3⌠SFcR"б#3C┐├3VfF6##c┐&Fcc&C3S3√3Fc3#Sss3√Fc&VSccVc3#cc├C6C#6632"г╡'fW'6√ЖБ#╒&36&33v3sV&3⌠⌠f⌠Svc3√S6Cs⌠⌠fC3┐√Vf3#6SCvccC&6fccCR"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#6#F3S3SCvFf6cc&VS&cSS3⌠#vfFS⌠S√#6CVS3&36#vC6SFC┐CV6Fb"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#V3#SVS#S##3v#s#s3&CF┐V#s┐#c#⌠√SSCs√3#c┐├3CfC⌠r"б&√вф√VDfВ&жB#ё⌠≈рб&CCs66cfSvSs6┐63cC√#S&c6&Ss⌠┐#⌠#VS6VS3⌠⌠vFSfV#⌠┐6&3"б&FF⌠fCCf#36sv#fCC3F66fVS┐c┐ffC⌠s3v3SfV33Cc#&3Cccc32"б#6Ss#3F3⌠S#s⌠C#v#3C├#Ff#FCc┐6cF#f#63c├3C6#6#⌠c┐sSf""б#CCFsv6S┐6c3#fFf##sSV&3v&C#f⌠&#F3CCf3Fc&cc⌠⌠#Fcss63&VV"б#├c┐⌠f&CFC33scFc┐33S⌠⌠&C#cc┐fVc⌠c┐┐Sfcs┐V63cSs#Sc3R"г╡'fW'6√ЖБ#╒##Vcc⌠66F3F63#C3S√c√fVVFf3ss#⌠#3⌠┐FVS3c66c#Cs⌠&6C#┐#6C3B"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#┐⌠#3&c#⌠⌠cS#√&fC┐&6Svf3SSvFSCCv3c#S├Cfcc├Cf#c3C├CcCC⌠√"б&√вф√VDfВ&жB#ёрг╡'fW'6√ЖБ#╒#s√#C3c⌠#36&3ffFs3V6#s┐S┐&3⌠├c6sv6c√#⌠vVVS#vScSfc┐&Sb"б&√вф√VDfВ&жB#ёрг╡'fW'6√ЖБ#╒#f33sCSCF3√#V&CSc63├3sFF6f#&cS⌠3⌠FfC⌠3⌠#cf3s┐sFF3⌠6V6#FR"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&Fc#6&c&3√SSCS#C#cS┐V&S√&Cc3⌠V#CC3c&3┐⌠├&#C&3#fb"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#V6#├c┐√Ff3┐┐√#c┐F#⌠fc3FS#C3&Svf&&FfCccCssCfSVffVSssR"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#⌠┐3cSssS┐S6fCS3├CVs#&S#3css├CV3S3C√fc3cc6cC6CsV3"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒##⌠┐C⌠sS┐c⌠6S36#3f3FS⌠#c┐&##6f6c√fc├&S&3vSscc6VCC⌠&3C3C▓"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#c├#6&ScSS3f#S#3333C6#6S3Cc┐##sSs3&#s├&VcF363#F√F6c3&"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CS┐┐⌠fVV#√F#&Vc&S⌠√FVV3CFSSSS3┐CCVSS┐C┐s3v6Ccf3c√f3F6#SVB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#fC3FCv63CFVfc3f6SC6S#SSCFS3V3C#6CFcSccv#F63#&F&2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#f&c├fVCcC##├#FCcVc33F#├fS&3cS⌠⌠S&fCSV#c⌠Ff#333⌠CC┐B"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CscSsvcs6f##S⌠&f3C├CfVF3v3SCC&V63V3CSCCFcC3csr"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&cSs3V┐fS├#C33C#S#CSCcS3#cs3⌠√fC&6VF3cffC┐ff6VS&Cr"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&fS#F&FScf&CCc⌠VCCfF6#F3#Ss⌠cfV&3├6f&c3CCC┐3⌠CVS√S⌠6S"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CS&F#6&VS&3⌠FVC├3sC3C┐CVFC√fVC3#CsvFC⌠F√63┐c3├&3#c3C#b"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CS√S#c┐Cs┐√SfVc3c┐S##CF6#v3S&f#s┐fSCcf3CV3ScC#sF63sfCB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#&66FfC36sS63├S├SVfS├VFVffc⌠c┐S3C⌠#&3√6F3vSF3⌠v#3fC6F6c┌"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CcFC3FCvf#SCF&SvCVcC⌠CVFVFS6S#┐#6c┐┐v#√cFVfCS#63""б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#⌠#vcCcSc┐⌠√fCv6C#3├VcvfSVS√3VS√V3┐#fcffc┐⌠┐3SC┐fc├6fC⌠vF"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&svCsC#CfSs├&#SFC3#V#c⌠fFsSCS⌠S3F#V#c&&S⌠3s3c33S62"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&c├FScFC6S63FF3⌠6&#3C┐⌠CcvC3⌠s√6#SS#6Svf66cCf&cSc#┐FSf33R"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&FF6&#sCs├V&36c3cv#ssSV63⌠CS3#⌠┐sS#v63√&VfCf#V6&6##SsB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#S#ScVcCss#f#S6&c6S3V#┐V33cVS&ScCSS┐⌠S├VcC3C├cc"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#vcV&V#6SC√&c3┐⌠Cs√C√F&&CsVCf66633√###fS├cvf#csCc√Ff#6C6fF"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#Cssc&3⌠#3s#S⌠3c┐Vf#6fcF#svc┐sFV3⌠Fc&F#v3┐CSCsScf&&#36c√R"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&cCC⌠├&3C┐cCcf&SVc⌠cC3⌠#s√3CS├fS⌠⌠&F3VCCS┐3#cSCc√#├CB"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#s√6C├3S⌠CsfCVS6#36##√#CvC#S┐3Ss┐#c&S6CF#33⌠┐┐┐6&Vf6""б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#6Sv&FC√f3C┐#6C3fc#⌠├F#sCFC&C⌠#FS&FVc┐s┐S#┐SSC√#├cVVf&f#cVb"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&C3√F6&f#├&6S##vSFSFFsC6cF633633fC3√VfC⌠cC6SvVcc├cS#636F#2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&&#C√#s┐#CC⌠√&3⌠F#c3vf&#SF##√F3Ss├6S3├SFf3vcv3┐┐33CC2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#sc#CC⌠cS√V3&&#c66S√FfSs┐&V##3#V3┐#&Sf┐&SSccf#⌠3F&SfCb"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&CvCcfc⌠FS⌠F⌠c√&Sv┐F3VCvS┐36sS⌠⌠┐┐√C√Vc3S⌠&F&CSScC#√""б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒#s√#3√CcsCv63⌠scc⌠├#s&3┐FSCS3#FS├3VC┐6S┐c√s├fS#V#Fc√V2"б&√вф√VDfВ&жB#ё⌠≈рг╡'fW'6√ЖБ#╒&SVfCfSf#3#┐√C⌠√&f&3cfFFS√Cv363├CvS√3CC├C&fCS#├VCfS3c#&"б&√вф√VDfВ&жB#ё⌠≈рб&CSs3c3fFFSC├V3sf┐⌠V3cFC⌠&cv#v6&c⌠F6fScS┐⌠fCC6C##CcVB"б#&cc┐s6V3⌠&SSCSF&C⌠C├CScsF3FF#⌠#⌠3&CS√Vc6#6#s3&S⌠2"б#VFSFCf3┐√#V3⌠sc6CSF3VsScC⌠6V#3sSSFF&csc3C6&SC⌠CF#▓"б#sSC√V3CsV3cS6&SC&3C√Vc6S┐C&f├C6S#⌠ss6SVff#C6C┐√&SFC├c"б#┐sCfV&3Sv&VVFScfVVS#┐Vcs⌠cC┐├63c&┐V6CS3⌠6S√V366VS┌"б&C3Ss#├fSFFfc⌠6##vS√c√&C6CV#CFCCcvSsF3┐cv3┐6FCvVS┐⌠c3fR"б#⌠⌠FS√3CCc├⌠6c36V3┐┐3V3s⌠S√#┐⌠s⌠c3#⌠├#V3###cSF3B"б#c⌠⌠cc⌠├css#┐S3c#cc&fSs┐CcsSVS3sS#S6C333&3sFCs&S#f3"б#CC&cSVCFSCvcSSVfCS#VCC┐Cf3#36&cc├C⌠C&F#CS√s⌠FcVs3C┌"б&C⌠┐c┐F√S&F#┐##├6#&&#&c├3V3⌠3SFSV#⌠66V3├S#c#├C┐Ss√3┐⌠&Cr"б&F#33S3#3scSc┐Sv&Sc┐3C3V3s#FFS√SS&&6#c3√3&6#√&c3√S├B"г╡'fW'6√ЖБ#╒&CF##v#C┐fS&&Sf&fC6C&36Cc&CCVF#3fC3f3Cc⌠vFc#c⌠&S⌠┐⌠f3┌"б&√вф√VDfВ&жB#ёурб'&ЖВB#╔ЁS3цS3"цSC2еЁSc┌цSsреЁSs▓цS┐%рцc3RеЁc3rцcCрцcC"цcC2еЁcCrцcSреЁc┐rцc⌠uурб&ВF√ЖГ2#╖╡&ффВt╖2#╖G'VRб&W4жЖGVфT√ГFW&В#╖G'VRб&╖7┌#ёBб&жЖGVфR#ё⌠▓б'6╤≈ф√$6├V6╡#╖G'VRб'7G&√7B#╖G'VRб'F&vWB#ёGрб'&VfW&VФ6VDж#╔╣Ёc⌠bцреЁS3ц%реЁc⌠rц5реЁc32цEреЁc3BцEреЁS3"цUреЁSC2цeреЁS┐┌цuреЁS┐rц%реЁCRц%реЁ3sBц%реЁS⌠rц%реЁcsbц┘реЁc┐ц∙реЁcc2цреЁccBцреЁcc"ц%реЁcs┌ц%реЁcs▓ц5реЁcSbцEреЁcSRц%реЁcSBцUреЁc⌠┌цUреЁCцeреЁCцeреЁC"цuреЁ⌠rц┘реЁC2ц∙реЁCBц#реЁCRц#реЁ⌠"ц%реЁ⌠Rц#%реЁ⌠2ц%реЁ⌠Bц%реЁCbц#5реЁCrц#EреЁC┌ц#UреЁC▓ц#eреЁSц#uреЁSц#┘реЁS"ц#┘реЁS2ц#∙реЁSBц3реЁSRц3реЁSbц3%реЁ⌠┌ц%реЁ⌠bц%реЁSrц35реЁS┌ц3EреЁS▓ц3UреЁ⌠ц3eреЁcц3uреЁcц3┘реЁc"ц3∙реЁc2цCреЁcBцCреЁcRцC%реЁcbцC5реЁcrцCEреЁc┌цCUреЁc▓цCeреЁsцCeреЁsцCuреЁs"ц%реЁs2цC┘реЁsRцC∙реЁsBцSреЁsbцSреЁsrцS%реЁs┌цS5реЁs▓цSEреЁ┐цSUреЁ┐цSeреЁ┐"цSuреЁ┐2цS┘реЁ┐BцS∙реЁ┐RцcреЁ┐bцcреЁ┐rцc%реЁ┐┌цc5реЁ⌠▓ц%реЁц%реЁц%реЁ3▓цcEреЁ┐▓цcUреЁ⌠цceреЁ⌠RцcuреЁCcцc┘реЁ⌠bцc∙реЁ⌠BцsреЁCc"цsреЁCcцs%реЁ⌠"цs5реЁCS┌ц%реЁ⌠2цsEреЁ┐2ц%реЁ┐RцsUреЁCSrцc┘реЁ##bцc┘реЁcS2ц%реЁ┐Bц%реЁcsRцseреЁcsBцsuреЁS┐▓цs┘реЁc┐bц%реЁS3Bцs∙реЁS3Rцs∙реЁS32ц┐реЁS3bц┐реЁS3rц┐%реЁS3┌ц┐5реЁcCbц┐EреЁSsRц┐UреЁSsBц┐eреЁSs2ц┐uреЁSC"ц┐┘реЁSCц┐∙реЁSCц⌠реЁS3▓ц┐реЁcCRц⌠реЁSs┌ц⌠%реЁSs"ц⌠5реЁSsbц⌠EреЁSsrц⌠UреЁSsц%реЁc3"ц⌠eреЁc#rц⌠uреЁc#bц⌠┘реЁcц⌠uреЁc#▓ц⌠∙реЁc#┌цреЁc#"ц⌠∙реЁc▓ц⌠uреЁc#RцреЁc#2ц⌠∙реЁc#Bц⌠uреЁc3ц%реЁc3ц⌠∙реЁcCBц5реЁC┐2цEреЁC┐┌цреЁC⌠RцUреЁCs┌цeреЁ#3ц%реЁ#3┌цuреЁ3s┌ц┘реЁ3┐ц∙реЁ3S2ц%реЁ3cbцреЁ3s2цреЁ#SRц%реЁ3SRц%реЁ#3bц%реЁ3S"ц%реЁ3⌠┌ц5реЁ#3rц%реЁ##┌цEреЁ3┐цUреЁ3┐"цeреЁ3┐2цuреЁCSRц┘реЁ3Crц∙реЁ3ц#реЁ3cц#реЁ3cц#%реЁ3S▓ц#5реЁ3S┌ц%реЁ3SBц#EреЁ3s▓ц#UреЁ#3▓ц#eреЁC#Rц%реЁC#bц#uреЁ#cbц#┘реЁ#Cц#∙реЁ#crц#┘реЁ32ц#┘реЁ#bц#┘реЁ3sbц3реЁ3sRц%реЁ3cRц3реЁCs2ц%реЁ#Rц%реЁC⌠Bц3%реЁC32ц35реЁC3Bц3EреЁC3ц3UреЁS"ц%реЁ33ц%реЁC3Rц3eреЁC3ц3uреЁSrц3┘реЁSbц3∙реЁSц%реЁ#┐ц%реЁ332цCреЁ33"ц%реЁSцCреЁC3"цc┘реЁ#┐bцC%реЁ#⌠2цC5реЁ#⌠RцCEреЁ#┐Rц%реЁ#⌠цCUреЁ#⌠"цCeреЁ#⌠BцCuреЁ#┐▓цC┘реЁ#┐rц%реЁ#⌠цC∙реЁS2ц%реЁS▓ц%реЁSRцSреЁSBц%реЁ#┐BцSреЁSBцS%реЁSrцS5реЁ#sBцSEреЁ#s2цSUреЁ#s"цSeреЁS#цc┘реЁ#sцSuреЁ#cц%реЁS#"ц%реЁS#2цc┘реЁS#BцS┘реЁ⌠┌ц%реЁ3c"цS∙реЁ3c2цcреЁ3cBцcреЁ#"ц%реЁ3crц%реЁ##"цc%реЁ⌠rц%реЁCCrцc┘реЁ#Bцc5реЁCCbцcEреЁCCRцcUреЁC3bц%реЁC3rц%реЁCCBц%реЁC3▓ц%реЁCC"цceреЁC3┌ц%реЁCCцcuреЁCC2цc┘реЁCCцcuреЁ#3Rц%реЁ#3"ц%реЁ#32ц#┘реЁ3┐rц%реЁ3⌠"цc∙реЁ3⌠2цsреЁ3⌠цsреЁ3┐▓цs%реЁ3⌠цs5реЁ3┐Rц%реЁCS2ц3eреЁ##rц3eреЁC┐"цsEреЁC┐▓цsUреЁC⌠2цseреЁ3#цsuреЁ3#ц%реЁ3Rц%реЁCc▓цs┘реЁCsrцs∙реЁ3C┌ц┐реЁ3C▓ц┐реЁC#┌ц┐%реЁ33rц%реЁCSц┐5реЁ3#Rцc┘реЁ3C"ц┐EреЁCSBц┐UреЁ33┌ц%реЁ3Cц┐eреЁ33▓ц%реЁCS"ц┐uреЁCC▓ц┐┘реЁCC┌ц%реЁCSц%реЁ3CRц%реЁC#Bц┐∙реЁ#ц⌠реЁ3#2ц⌠реЁ3#rц⌠%реЁ3C2ц⌠5реЁ3Cbц⌠EреЁ33Rц⌠UреЁ3#┌ц⌠eреЁCsbц⌠uреЁCц⌠┘реЁ3▓ц⌠∙реЁ#rц#реЁCsRц#реЁ#2ц#%реЁ3⌠Bц#5реЁ3┐bц%реЁ3⌠Rц#EреЁC2ц#UреЁ3┐Bц%реЁC"ц#eреЁ⌠ц%реЁCrц#uреЁ#3ц%реЁC#rц#┘реЁC"ц%реЁ#bц%реЁ#┌ц%реЁ3Srц%реЁCц#∙реЁ#3Bц%реЁ#S┌ц#реЁ3CBц#реЁ#cBц#%реЁ3#Bц%реЁCц%реЁ3┐┌ц%реЁCRц#5реЁCbц#EреЁ3Sbц%реЁC┌ц#UреЁC#ц#eреЁC▓ц#uреЁ3c┌ц%реЁC▓ц#реЁC#"ц#┘реЁ3┌ц#∙реЁC┌ц##реЁCBц##реЁ#C2ц%реЁ#Crц%реЁ#Cbц%реЁ#CRц%реЁ#Sц%реЁ#CBц%реЁ#S2ц%реЁ#S"ц%реЁ#C▓ц%реЁ#C┌ц%реЁ#Sц%реЁ#SBц##%реЁ#C"ц%реЁ3ц##5реЁ3▓ц%реЁ3Bц##EреЁ3ц##UреЁ32ц##eреЁ3bц##EреЁ3"ц##UреЁ##2ц##uреЁ3"ц##┘реЁCs"ц##∙реЁCsц%реЁC⌠▓ц#3реЁSц#3реЁCcRц#3%реЁSц#35реЁ#ц#3EреЁ#┌ц#3EреЁ#Cц%реЁ##Rц#3UреЁ##Bц#3eреЁ##ц#3uреЁ##ц#3┘реЁ##▓ц#3∙реЁ#Srц#3∙реЁ#c┌ц#3∙реЁ3Bц#CреЁ#c▓ц#CреЁ#2ц#CреЁ#"ц%реЁ3┌ц#C%реЁ3rц#C5реЁ3bц#CEреЁ3Rц#CUреЁ#Bц#CeреЁCSbц#CuреЁ#Sbц#C┘реЁCcBц#C∙реЁC#▓ц#SреЁCS▓ц#SреЁCc2ц#S%реЁ3Sц#S5реЁ3Sц#SEреЁ33ц#SUреЁ3rц#SeреЁ#⌠▓ц#SuреЁ3ц#S┘реЁ#⌠┌ц#S∙реЁC#ц#cреЁ3#"ц%реЁC┐rц%реЁ#▓ц#cреЁC#2ц#c%реЁCsц#c5реЁ3#▓ц%реЁ#S▓ц#cEреЁ33bц#cUреЁ33Bц#ceреЁ#cц#cuреЁ3⌠bц#c┘реЁCcbц%реЁ#c"ц#c∙реЁ3⌠rц#c∙реЁC┐Rц%реЁC┐Bц%реЁC┐bц%реЁCc┌ц%реЁCcrц%реЁ3⌠▓ц#sреЁ3#bц%реЁ#⌠bц#sреЁ#rц#s%реЁ#sRц%реЁ#ц#s5реЁ#c2ц%реЁC⌠цc┘реЁ#ц%реЁS2ц#sEреЁ#┐2цc┘реЁC⌠rц3eреЁ#┐"ц#sUреЁC┐ц#seреЁ#┐ц#sEреЁ#Rц%реЁSRц#suреЁ#s┌цc┘реЁ#s▓цc┘реЁ#sц%реЁ⌠▓ц%реЁ#srц#s┘реЁ#sbц#s∙реЁ#cRц#┐реЁ3CцCUреЁCцCUреЁCrц%реЁCBц#┐реЁC2ц%реЁ#┐┌цSреЁ#▓ц%реЁ#⌠rцc┘реЁCsBцc%реЁC┐ц#┐%реЁ┐bцc┘реЁ┐▓ц#┐5реЁ⌠ц#┐EреЁ┐rцc┘реЁ┐┌ц%реЁ3srц#┐UреЁ3s"ц#┐eреЁ3sц%реЁ3sц#┐uреЁ3c▓ц%реЁCs▓ц#┐┘реЁC⌠ц#┐∙реЁC⌠"ц#⌠реЁC⌠bц#⌠реЁC⌠┌ц#⌠%реЁS"ц#⌠5реЁS3ц#⌠EреЁSbц#⌠EреЁS#▓ц#⌠UреЁS┌ц#⌠eреЁS┌ц#⌠uреЁS▓ц#⌠┘реЁS#ц#⌠∙реЁS#Rц3реЁS#┌цc%реЁS#rц%реЁS#bц3реЁccц3%реЁccц35реЁcS┌ц%реЁcS▓ц%реЁScц3EреЁSS┌ц3UреЁSS▓ц3eреЁSCrц3uреЁSC┌ц3UреЁSSRц3┘реЁSCbц3∙реЁSSц3реЁScц%реЁSS"ц3реЁSSrц3%реЁSc2ц35реЁSc"ц3EреЁSCRц3UреЁSS2ц3eреЁSSBц3uреЁSC▓ц3┘реЁSSbц3EреЁSSц3∙реЁcs2ц3#реЁcsц3#реЁcsц%реЁcs"ц%реЁcc▓ц3#%реЁCbц3#5реЁc┐"ц3#EреЁc┐Bц%реЁc┐Rц3#UреЁcSrцреЁcsrц3#eреЁc┐2ц3#uреЁcS"ц%реЁc┐ц3#┘реЁSCBц%реЁcc┌ц3#∙реЁccbц33реЁccrц33реЁccRц%реЁScbц33%реЁScRц%реЁScBц%реЁScrц335реЁ┐ц%реЁ┐"ц%реЁ2ц%реЁBц%реЁbц%реЁRц%реЁ"ц%реЁrц%реЁ┌ц%реЁ▓ц%реЁ#ц%реЁ#ц%реЁ#"ц%реЁ#2ц%реЁ#Bц%реЁ2ц%реЁ#Rц%реЁ#bц%реЁBц%реЁ#rц%реЁ3ц%реЁ#┌ц%реЁ#▓ц%реЁ3ц%реЁ3"ц%реЁ32ц%реЁ3Bц%реЁRц%реЁ3Rц%реЁ3bц%реЁ3rц%реЁ3┌ц%реЁbц%реЁC"ц%реЁ3▓ц%реЁCц%реЁCц%реЁC2ц%реЁrц%реЁCBц%реЁC▓ц%реЁSц%реЁCRц%реЁCbц%реЁCrц%реЁC┌ц%реЁ┌ц%реЁSBц%реЁSц%реЁS"ц%реЁS2ц%реЁSRц%реЁ▓ц%реЁSbц%реЁSrц%реЁS┌ц%реЁcц%реЁS▓ц%реЁcц%реЁc"ц%реЁц%реЁc2ц%реЁcBц%реЁcRц%реЁц%реЁcbц%реЁcrц%реЁc┌ц%реЁc▓ц%реЁsц%реЁц%реЁsц%реЁs"ц%реЁ"ц%реЁsbц%реЁsBц%реЁs▓ц%реЁs┌ц%реЁs2ц%реЁsrц%реЁsRц%реЁ┐ц%реЁrц33EреЁ#rц33UреЁbц33EреЁ3rц33eреЁ┌ц33uреЁrц33┘реЁ3bц3реЁ3ц33∙реЁ3Rц3CреЁц3CреЁ#Bц3C%реЁ▓ц3C5реЁ32ц3CEреЁRц3CUреЁBц3реЁ3Bц3CeреЁbц3CuреЁц3C┘реЁ"ц%реЁRц3C┘реЁ"ц%реЁ3┌ц3C∙реЁ#┌ц3SреЁ▓ц3SреЁ#ц3S%реЁ#"ц3S5реЁ┌ц3SEреЁ#ц3SUреЁ3ц3реЁ2ц3SeреЁBц3SuреЁ#2ц3S┘реЁ2ц3S∙реЁ#bц3SреЁ#Rц3C┘реЁ#▓ц%реЁ3"ц3cреЁc┌ц3cреЁS┐2ц%реЁS⌠"ц%реЁcBц3c%реЁc"ц3c5реЁS┐bц3cEреЁS⌠ц3cUреЁcц3ceреЁcbц3cuреЁS⌠┌ц3c┘реЁS⌠▓ц%реЁcrц3c∙реЁcRц3sреЁS⌠bц3sреЁS⌠Bц3s%реЁS⌠2ц%реЁcц%реЁS⌠ц3ceреЁc2ц%реЁS┐Rц%реЁS┐Bцc┘реЁS⌠Rц%реЁc#цреЁc#ц3s5реЁc▓ц3sEреЁcц3sUреЁc┌ц3seреЁcrц3suреЁc2ц⌠uреЁcbц3cuреЁcBц%реЁcRц⌠uреЁc"ц3s┘реЁSsц3s∙реЁcSц3┐реЁc┐┌ц3┐реЁc┐▓ц3┐%реЁc⌠ц3┐5реЁc⌠"ц3┐EреЁc⌠ц3┐UреЁc⌠2ц3┐eреЁc⌠Bц3┐uреЁcCrц3┐┘реЁcC▓ц3┐uреЁc⌠Rц3┐uреЁcC2ц3┐∙реЁc┐rц3⌠реЁcC┌ц3eреЁcSц3⌠реЁS┐ц3⌠%реЁS┐"ц3⌠%реЁc3bцEреЁcCцEреЁc3Rц3⌠5реЁSs▓ц3⌠EреЁc3rц3⌠UреЁc3┌ц3⌠%реЁSc▓цEреЁc3▓ц3⌠%реЁcCц3⌠UреЁcC"ц3⌠eреЁS┐ц3⌠uреЁSc┌ц3⌠┘урб&ffV7FVDf√фW5VФF√ФtVж≈B#╔Ёc⌠rцSC2цSsцcSцc┐┌цc┐▓цc⌠цc⌠"цc⌠цc⌠2цc⌠BцcCrцcC▓цc⌠RцcC2цc┐rцcC┌цcSцS┐цS┐"цc3RцSs▓цc3rцc3┌цSc▓цc3▓цcCцcC"цS┐цSc┘рб'fW'6√ЖБ#╒#RЦ▓Ц2'