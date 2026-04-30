# How to use:
**AskOntology** is an explorative method to validate an ontology. It is proposd by me, Arghavan Akbarieh. It is not tested. So, now, I am testing it on the **MOAF-DiT ontology** for the MOAFDiT project. The idea is to validate, optimise and expand the ontollgy through RAG and Sub-graph extension method. 
A user of the ontology, who is disjoint fron the ontology developer, is the target user of this method. By asking natural-language questions from the schema (not the knowledge graph), the method helps users to check what classes or relationships exist, and if not, they an then propose those. In this way, the ontology will be exanded and compeleted through user requests.

> 🔗 **Link:** [https://z-arghavan.github.io/AskOntology2/](https://z-arghavan.github.io/AskOntology2/)

---

## Table of Contents

1. [What this tool does](#1-what-this-tool-does)
2. [Before you start — API key](#2-before-you-start--api-key)
3. [Step-by-step setup](#3-step-by-step-setup)
4. [Asking questions](#4-asking-questions)
5. [Understanding the results](#5-understanding-the-results)
6. [Follow-up questions and conversation memory](#6-follow-up-questions-and-conversation-memory)
7. [Adding your suggestion or opinion](#7-adding-your-suggestion-or-opinion)
8. [Proposing a missing concept](#8-proposing-a-missing-concept)
9. [Your session log](#9-your-session-log)
10. [What happens to your questions](#10-what-happens-to-your-questions)
11. [Tips for better results](#11-tips-for-better-results)
12. [Frequently asked questions](#12-frequently-asked-questions)

---

## 1. What this tool does

The tool allows you to:

- **Ask questions** about the MOAF-DiT ontology schema in plain English
- **Find out** whether a concept (class, property, relationship) exists in the ontology
- **See details** about any matched concept — its definition, parents, subclasses, domain, range, and an example triple
- **Ask follow-up questions** in a conversation — the tool remembers what was said earlier
- **Propose missing concepts** if something you need is not found
- **Add notes or opinions** on any answer to help the ontology author improve it

You have to use your own API key. It is not stored on my server or storage. For the purpose of research, your questions and suggestions are recorded to improve the ontology accordingly.
---

## 2. First steo: API key

The tool uses **Google Gemini** to understand your questions and generate answers. You need a free API key.

### Get your key (free)

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the key — it looks like `AIzaSyAbc123xyz...`

> The free tier allows up to **15 requests per minute** and **1,500 per day** — more than enough for normal use.  
> Your key is saved only in **your own browser**. It is never sent to our server or stored anywhere else.

---

## 3. setup

### Step 1 Enter your API key

When you open the tool you will see the **Configure & Upload** panel.

- Paste your Gemini API key into the **API Key** box
- Click **Save**
- A green ✓ confirmation appears

Your key is stored in your browser's local storage and will be remembered next time you visit on the same device.

### Step 2 Upload the ontology

- Click the **dotted upload box** (or drag and drop a file onto it)
- Select the MOAF-DiT ontology file: **`ontology.ttl`**
- The tool parses the file and shows a summary: number of classes, properties, individuals

> 📎 If you do not have the ontology file, ask the project lead (Arghavan) for the latest version, or download it from the [MOAF-DiT repository](https://github.com/Z-Arghavan/MOAF-DiT).

### Step 3 Build the semantic index

After uploading you will see two options:

| Option | What it does | When to use |
|--------|-------------|-------------|
| **🚀 Build index** | Sends all ontology entities to Gemini to create semantic embeddings. Gives the most accurate search results. Takes ~1–2 minutes. | Recommended for detailed exploration |
| **String-match only** | Searches by word overlap. No API calls needed. Instant. Less accurate for complex questions. | Quick checks or when API is unavailable |

Click **Build index** and wait for the progress bar to reach 100%.

Once complete, the **Ask the Schema** panel unlocks automatically.

---

## 4. Asking questions

Go to the **Ask the Schema** tab. Type your question in the text box and either:

### What you can ask

The tool is designed for questions about the **ontology schema** — the structure and vocabulary of the ontology. It does not query live production data.

| Type of question | Example |
|-----------------|---------|
| Does a concept exist? | `Does a Defect class exist?` |
| What properties does something have? | `What properties does WorkOrder have?` |
| How is something defined? | `What is a WIPEntity?` |
| What are the subclasses of something? | `What are the subclasses of Machine?` |
| Counting questions | `How many classes are there?` |
| Listing questions | `List all object properties` |
| Missing concept check | `Is there a concept for material shortages?` |
| Relationship questions | `How is BoardType related to MaterialType?` |

---

## 5. Understanding the results

After you ask a question, three things appear:

### Coverage banner

A coloured banner at the top tells you the overall result:

| Banner | Meaning |
|--------|---------|
| ✅ **Fully covered** | The concept exists clearly in the ontology |
| ⚠️ **Partially covered** | Something related exists but the concept is not fully modelled |
| ❌ **Not covered** | The concept does not appear to exist in the ontology |

The banner also shows a one-sentence explanation of why that coverage was assigned.

### Matched entity cards

Below the banner you see cards for each ontology entity that matched your question. Click any card to expand it and see:

| Field | What it shows |
|-------|--------------|
| **Definition** | The `rdfs:comment` description of the entity |
| **Type** | Class / ObjectProperty / DataProperty / Individual |
| **Parents** | Superclasses or parent properties |
| **Subclasses** | Direct subclasses (for classes) |
| **Domain / Range** | What the property connects (for properties) |
| **IRI** | The full unique identifier of the entity |
| **Example triple** | A sample RDF statement using this entity |

The **% match** shown in each card is the similarity score between your question and that entity — higher means a closer match.

### Gemini answer

Below the cards is a natural-language answer generated by Gemini based on the matched entities and their relationships in the ontology. This answer is grounded in the ontology content — it will not invent concepts that are not there.

### Similar concepts chips

If your exact term was not found but related terms exist, blue chips appear:

> 💡 Similar concepts in ontology: `:WorkOrder` `:WIPEntity` `:BoardType`

Click any chip to automatically search for that concept.

---

## 6. Follow-up questions and conversation memory

The tool remembers your previous questions and answers within a session. This means you can have a real conversation.

**Example:**

> You: `Is there a class for material shortages?`  
> Tool: ❌ Not covered — no MaterialShortage class exists...  
> You: `What do you suggest instead?`  
> Tool: Based on the existing structure, I suggest a class called `MaterialShortage` as a subclass of `MaterialAllocation`...

The blue **🧠 Memory active · N turns in context** bar above the question box shows when memory is on and how many turns are being remembered.

### Starting a new conversation

Click **🔄 New conversation** to clear the memory and start fresh. This does not delete your session log — your previous Q&As remain visible below.

---

## 7. Adding your suggestion or opinion

Every answer in your session log has a **💬 Add suggestion / opinion** button. This is one of the most important features for ontology validation.

**How to use it:**

1. Scroll down to any answer in your session log
2. Click **💬 Add suggestion / opinion**
3. A text box opens below that answer
4. Write your comment — for example:
   - *"I think this class should also include a property for penalty cost"*
   - *"The definition of WIPEntity is unclear to me as a planner"*
   - *"We need a separate class for rework vs. scrap"*
5. Click **Save note**

Your note appears in purple below the answer and is sent to the ontology author's analytics dashboard. This is how your domain knowledge helps improve the ontology.

---

## 8. Proposing a missing concept

When the coverage is ⚠️ partial or ❌ missing, a **Propose a missing concept** form appears automatically below the answer.

The form is pre-filled based on the AI's suggestion. You can adjust any field:

| Field | What to enter |
|-------|-------------|
| **Concept name** | A CamelCase name suitable for OWL, e.g. `MaterialShortage` |
| **Type** | `owl:Class`, `owl:ObjectProperty`, or `owl:DatatypeProperty` |
| **Suggested parent** | The existing concept this should extend, e.g. `WorkOrder` |
| **Description** | What this concept should represent in plain language |
| **Example usage** | An example triple or relationship, e.g. `WorkOrder :hasShortage MaterialShortage` |

Click **Submit proposal**. Your proposal is logged and visible to the ontology author in the Admin dashboard.

> 💡 You do not need to fill every field. Even a name and description is useful.

---

## 9. Your session log

Below the question box, a **Conversation log** panel shows all the questions you have asked in this session in order — newest at the bottom.

Each entry shows:
- Your question (blue bubble)
- The time it was asked
- The coverage badge
- The answer
- Any missing concepts identified
- Your note (if you added one)

### Follow-up button

Each entry also has an **↩ Follow-up** button that scrolls you back to the question box so you can ask a connected question without losing your place in the log.

---

## 10. What happens to your questions

Every question you ask is stored in two places:

1. **Your browser** — visible only to you via the session log. Cleared when you close the browser.
2. **The project database** — sent to a secure database that only the ontology author (Arghavan) can access via the Admin panel. This includes:
   - Your question
   - The coverage result
   - Any missing concepts identified
   - The AI answer
   - Your session ID (a random code — not linked to your name or identity)
   - The timestamp

**No personal information is collected.** There is no login, no name, no email. Your session ID is a random string generated when you open the page.

The purpose of collecting questions is purely for **ontology validation** — to understand what concepts users look for but do not find, and to prioritise which gaps to fill in the ontology.

---

## 11. Tips for better results

**Be specific**
> ❌ `Tell me about materials`  
> ✅ `Does a class exist for tracking material shortages per work order?`

**Use domain terminology**
Terms from the manufacturing process (e.g. *wave soldering*, *AOI*, *work order*, *BOM*, *PCB*) will match better than generic terms.

**If nothing matches, try related terms**
If `shortage` returns nothing, try `material`, `allocation`, or `issued quantity`.

**Use the similar concept chips**
The blue chips below the results show what the ontology does have near your query. These are often a good starting point.

**Ask follow-up questions**
After getting a result, ask `What do you suggest?` or `How is this related to WorkOrder?` — the tool remembers the context.

**If you get a 429 error**
This means the Gemini API rate limit was hit. Wait 60 seconds and try again. The tool retries automatically.

---

## 12. Frequently asked questions

**Do I need to know OWL or SPARQL?**  
No. Write questions in plain English.

**Can I use my own ontology?**  
Not in this version. The tool is pre-configured for the MOAF-DiT ontology. A custom upload version may be available in future.

**Is my API key safe?**  
Yes. It is stored only in your browser's local storage and sent directly from your browser to Google's API. It never passes through our server.

**Why does it sometimes say "string-match result"?**  
This means the Gemini API was unavailable (usually a rate limit). The match was done by word overlap instead of semantic similarity. Results may be less accurate but still useful.

**What does the % match number mean?**  
It is the similarity score between your question and the matched entity — 100% is a perfect match. See [the technical explanation](https://github.com/Z-Arghavan/AskOntology2#how-matching-works) for details.

**My question was marked ❌ Not covered — does that mean the concept is definitely missing?**  
Not necessarily. The concept may exist under a different name. Try the similar concept chips, or rephrase your question. If after several attempts it is still not found, it is likely genuinely absent — please submit a proposal.

**Who sees my questions?**  
Only the ontology author (Arghavan) via the Admin dashboard. Questions are used only to improve the ontology.

---

## Questions or issues?

Contact the project lead: **Arghavan Akbarieh**  
Repository: [https://github.com/Z-Arghavan/AskOntology2](https://github.com/Z-Arghavan/AskOntology2)

---

*MOAF-DiT Project — Eurostars · UNIVIA · JEOIT · TU/e · KAREL*
