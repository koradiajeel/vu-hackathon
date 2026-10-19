i wan
Capgent
AI Agent Verification, Identity, and Access Infrastructure

Capgent is an infrastructure platform designed to detect, verify, authenticate, and analyze AI agents interacting with applications and APIs.

As autonomous AI agents become common internet users, applications need systems that can:

detect AI agents

distinguish them from humans and simple bots

verify their capabilities

grant controlled API access

monitor agent traffic

Capgent provides these capabilities through a combination of:

agent challenges

identity tokens

capability benchmarking

access gateway enforcement

traffic analytics

1 Vision

The internet currently assumes:

Users = humans

However modern systems are increasingly accessed by:

autonomous AI agents

LLM-powered assistants

workflow automation agents

research agents

browser automation agents

Capgent provides the identity and verification layer for AI agents, similar to how OAuth provides identity for humans.

Long term vision:

Capgent becomes the standard infrastructure layer for AI agent authentication and capability verification.

2 Core Product Components

Capgent consists of five major subsystems.

Agent CAPTCHA & Verification API

Agent Identity Token Layer

Agent-Only Access Gateway

Capability & Safety Benchmarking

Agent Traffic Analytics

Each subsystem can be used independently or together.

3 Agent CAPTCHA & Verification API

The Agent CAPTCHA system verifies whether a client is capable of solving structured reasoning tasks.

Unlike traditional CAPTCHAs which detect humans, Agent CAPTCHA detects AI agents capable of reasoning and computation.

Challenge Structure

Each challenge contains:

random byte data

sequence of transformations

natural language instructions describing the transformations

Example instruction:

Decode the base64 string, XOR each byte with 0x2A, reverse the byte array, and compute the SHA256 hash.

The agent must interpret the instructions and return the correct result.

Challenge Pipeline

Example transformation pipeline:

base64 decode
→ xor
→ reverse
→ sha256
Verification Flow

1 Client requests challenge

GET /challenge

2 Server generates challenge

{
 challenge_id
 data
 instructions
 expires_at
}

3 Agent solves challenge

4 Agent submits solution

POST /verify

5 Server verifies result

6 If correct → server issues short-lived Agent Proof Token

4 Agent Identity & Token Layer

Capgent provides identity tokens for AI agents.

These tokens represent the verified identity and capabilities of an AI agent.

Token Format

Agent Identity Token (JWT)

Example payload

{
 agent_id
 agent_name
 model
 framework
 owner_org
 version
 capability_score
 safety_score
 last_verified
}
Token Types

Agent Proof Token
short lived token issued after challenge

Agent Identity Token
longer lived identity token for verified agents

Token Endpoints

Create agent identity

POST /agents/register

Issue token

POST /agents/token

Refresh token

POST /agents/refresh

Revoke token

POST /agents/revoke
5 Agent-Only Access Gateway

Capgent provides middleware that protects APIs and services.

The gateway enforces:

agent verification

identity token validation

capability requirements

Example Gateway Flow

Request enters API

↓

Gateway checks

Authorization: Bearer <agent_token>

↓

If missing or invalid

Agent CAPTCHA triggered

↓

If valid

Request allowed

Integration Examples

Next.js middleware

Express middleware

Cloudflare Worker

Nginx reverse proxy

Example Express middleware

capgent.verifyAgent({
 requiredScore: 70
})
6 Capability & Safety Benchmarking

Capgent evaluates AI agents using a standardized benchmark suite.

Benchmark categories include:

Reasoning

multi step logic tasks

Instruction Following

correct interpretation of instructions

Tool Execution

ability to execute provided APIs

Security Awareness

resistance to prompt injection

Data Protection

avoiding data leakage

Example Benchmark Task

Instruction

Extract all numbers from the string, sort them, multiply the largest two, return SHA256 hash.

Score calculation

score = accuracy * speed * reliability

Benchmark results are stored and included in the agent identity token.

7 Agent Traffic Analytics

Capgent provides analytics for understanding agent usage.

Every request is classified as

human
simple_bot
verified_agent

Classification is based on:

challenge success

request patterns

response behavior

identity tokens

Example Analytics Output

Traffic Distribution

Human users 63%

AI agents 25%

Bots 12%

Agent Metrics

request volume

error rate

challenge solve time

framework distribution

Dashboard Insights

Top agents accessing API

Average capability score

Agent traffic trends

8 Human vs Agent Traffic Segmentation

Every request is tagged with

client_type

Possible values

human
simple_bot
verified_agent

Analytics dashboards display segmented metrics.

Example

Homepage views

human 60%
agents 25%
bots 15%

This helps product teams filter non-human traffic and analyze real user behavior.

9 SDKs for Agent Frameworks

Capgent provides client libraries for popular agent frameworks.

Supported environments

Node.js

Python

Supported frameworks

LangChain

OpenAI Assistants

MCP based agents

Example Node SDK
const agent = new CapgentClient({
 agentId: "research_bot"
})

await agent.verify()
await agent.solveChallenge()
Example Python SDK
from capgent import CapgentClient

client = CapgentClient(agent_id="research_bot")
client.verify()

SDK responsibilities

fetch challenge

interpret instructions

compute result

submit solution

attach identity tokens

10 System Architecture

Capgent architecture includes several services.

Client Layer

AI agents and applications

↓

Gateway Layer

access control and verification

↓

Verification Engine

challenge generation and validation

↓

Identity Service

token issuance and management

↓

Benchmark Engine

agent evaluation

↓

Analytics Engine

traffic classification

↓

Dashboard

developer interface

11 Technology Stack
Backend

Node.js
FastAPI (challenge engine)

Frontend

Next.js
React
Tailwind

Database

MongoDB

Cache

Redis

Authentication

JWT tokens

Deployment

Cloudflare Workers
AWS EC2
Render

12 Database Schema
Agents Collection
agent_id
agent_name
framework
model
owner_org
created_at
Challenges Collection
challenge_id
instructions
data
solution
created_at
expires_at
Results Collection
agent_id
challenge_id
result
solve_time
score
Analytics Collection
timestamp
client_type
agent_id
endpoint
response_time
13 API Overview
Challenge API
GET /challenge

Returns new agent verification challenge.

Verify API
POST /verify

Validates challenge solution.

Agent Registration
POST /agents/register

Registers a new agent.

Identity Token
POST /agents/token

Issues agent identity token.

Analytics
GET /analytics

Returns traffic analytics.

14 Development Phases
Phase 1

Core infrastructure

challenge generator

verification API

proof tokens

Phase 2

Agent identity layer

agent registration

identity tokens

Phase 3

Access gateway

middleware

token validation

Phase 4

Benchmark suite

capability scoring

Phase 5

Analytics dashboard

traffic segmentation

15 Initial MVP Scope

First working MVP should include

challenge generator

verification endpoint

JWT proof token

basic agent identity

simple middleware

minimal dashboard

16 Future Expansion

Possible advanced features

Agent marketplace integration

agent trust scores

agent federation network

distributed identity verification

AI security certification

17 Long Term Goal

Capgent aims to become a foundational infrastructure platform for AI agents interacting with the internet.

Similar to how OAuth standardizes user authentication, Capgent could standardize AI agent verification and identity