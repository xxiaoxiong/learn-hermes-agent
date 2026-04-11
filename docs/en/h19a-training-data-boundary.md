# h19a — Training Data Boundary: Why the Hard Part of Trajectory Collection Isn't "Can We Save It" but "What's Worth Entering the Training Set"

> This page extends `h19`. The main chapter covered trajectory recorder, batch runner, and ShareGPT format; this bridge doc clarifies the most critical boundary from the training data perspective: **agent runtime logs do not equal training samples — the real difficulty is deciding which trajectories are worth keeping, filtering, compressing, and learning from.**

---

## The Bottom Line

Many people first see trajectory saving and naturally think: just save every agent conversation, get enough data volume, then process uniformly during training.

But in reality, whether logs can be saved is often not the hardest problem. The harder questions are:

- Which trajectories should enter the training set
- Which are just debug logs
- Which should be discarded outright
- Which need compression, cleaning, anonymization, or format rewriting first

In other words, `h19`'s real difficulty was never persistence — it's **dataset curation**.

---

## 1. Why "Save Everything" Doesn't Equal "Everything Is Trainable"

A single agent run produces many different kinds of information: real user needs, model reasoning and tool calls, raw tool return results, failed retry paths, auxiliary internal actions, temporary noise, and ineffective loops.

If you dump all of this into the training set, it usually won't make the model stronger — it may teach it many behavioral patterns you don't want to preserve.

For example: runaway loops, verbose inefficient tool usage, excessive reliance on internal helper tools, intermediate artifacts exposing system implementation details.

So "can be saved" is just logging-layer success — it's a long way from "worth training on."

---

## 2. Why There Must Be a Filtering Boundary Between Trajectory and Dataset

Hermes' trajectory saving inherently has two layers of objectives:

### Logging objective

- Facilitate debugging
- Facilitate post-mortem review
- Facilitate auditing failure paths

### Training objective

- Provide learnable behavioral patterns for models
- Retain high-quality, high-signal samples as much as possible
- Reduce noise and erroneous guidance

These two objectives don't always align. A failure trajectory very valuable for debugging may be a negative sample — or even a dirty sample — for training.

So there must be an explicit filtering boundary between trajectory collection and the training dataset.

---

## 3. Why Format Unification Is Just the First Step, Not the Last

Converting trajectories to ShareGPT or other unified formats is certainly important — without unified format, downstream processing becomes chaotic.

But format unification only solves "can we process it," not "should we keep it."

- `to_sharegpt()` solves the representation problem
- `TrajectoryFilter` solves the sample quality problem

If you mistake format conversion for data cleaning itself, you get a false sense: once exported to a standard format, the data is ready. Reality is usually the opposite.

---

## 4. Why Low-quality Trajectories Are Often More Harmful Than "Having Less Data"

A common beginner intuition: collect more first, figure it out later.

But training data differs from regular logs. Low-quality samples don't just "not help" — they can actively pull the model in the wrong direction:

- Learning meaningless loops
- Learning incorrect tool call sequences
- Learning wrong preferences for failure paths
- Learning large amounts of Hermes internal implementation details rather than task completion capabilities

What training data fears most isn't scarcity but "high noise that superficially looks like a lot."

In many scenarios, fewer but cleaner trajectories far outperform more but messier ones.

---

## 5. Why Internal Auxiliary Actions Don't Necessarily Belong in the Training Set

Hermes runs include some highly internal actions: memory write, session search, certain runtime-specific routing traces, debugging and recovery metadata.

These actions are certainly important for Hermes' own operation, but they don't necessarily equal "behaviors the model should learn."

Here lies a critical boundary:

> Which are general agent behaviors needed to complete tasks, and which are just internal implementation details of a specific system?

Without drawing this line first, the model may end up learning not "how to solve tasks" but "how to mimic a particular runtime's surface traces."

---

## 6. Why Reward / Filter / Export Are Essentially Different Checkpoints on the Same Line

In `h19`'s main line you see: trajectory collection, quality filtering, reward calculation, export of training samples.

They look like different process segments, but from the training boundary perspective, they all answer the same question:

> Is this run worth learning from?

The difference is just:

- Filter is more like hard thresholds
- Reward is more like quality scoring
- Export decides which training format it ultimately enters

So these steps aren't a loosely assembled pipeline — they progressively tighten around the core judgment of "which samples to keep."

---

## 7. Why Failed Trajectories Aren't Universally Useless

It's easy to swing to the other extreme: should all failed trajectories be discarded?

Not necessarily. What matters isn't the binary "success or failure" label but whether the trajectory carries training-valuable signal.

For example:

- Some failed trajectories suit debugging data
- Some suit negative feedback learning
- Some are pure noise and should be discarded outright

What's truly needed is sample stratification, not simple binary division.

This also explains why separating `trajectory_samples.jsonl` and `failed_trajectories.jsonl` for split storage is meaningful: they're first distinguished at the data layer, then can receive different treatment at the training strategy layer.

---

## 8. A Useful Decision Rule

When facing a class of trajectories, ask four questions:

### Did it complete a clear task?

If the task objective itself was vague, training value is usually low.

### Did it demonstrate desirable agent behavior patterns?

For example: efficient tool usage, reasonable stopping, clear summarization.

### Does it carry excessive system internal noise?

If the primarily visible content is runtime-specific intermediate actions, be cautious.

### Does it need compression, filtering, or anonymization before entering the training set?

Many samples aren't unusable — they just can't be used directly.

This decision rule is simple but helps you avoid the "logs equal samples" pitfall.

---

## 9. How This Connects to the Main Chapters

- `h19`: Understand trajectory recorder, batch runner, reward, and the export pipeline
- This page: Shift focus from "how to save" to "what's worth learning"
- Looking back:
  - `h10` reminds you that failure recovery paths may not be worth learning directly
  - `h15` reminds you that complex delegation trajectories carry more noise
  - `h16` reminds you that provider/runtime differences can also pollute surface-level data

This helps you see `h19` as a data governance problem, not just a batch saving problem.

---

## 10. The One Takeaway from This Page

Agent runtime logs do not equal training samples.

The real difficulty isn't saving trajectories but continuously judging: which trajectories deserve to enter the training set, which only suit debugging, which should be cleaned before learning from, and which should be discarded outright.
