# Code Audit Report — Cold-Email

**Date:** 2026-07-20
**Method:** multi-agent audit — 5 specialized finder agents (security, correctness, quality, config/secrets) swept the codebase in parallel; every finding was then independently re-checked by an adversarial verifier agent instructed to refute it against the actual code. Only findings confirmed with file:line evidence appear below.
**Result:** 8 confirmed findings in this repo (4 medium, 4 low).

## Summary

| # | Severity | Location | Finding |
|---|----------|----------|---------|
| 1 | MEDIUM | `backend/requirements.txt:27` | Unresolvable private package pin 'emergentintegrations==0.1.0' — dependency-confusion vector |
| 2 | MEDIUM | `backend/server.py:43` | Unauthenticated, unbounded write endpoint into MongoDB |
| 3 | MEDIUM | `frontend/app.json:31` | app.json references splash asset that does not exist |
| 4 | MEDIUM | `frontend/metro.config.js:9` | 11,603 Metro build-cache files committed to git, leaking internal preview endpoints |
| 5 | LOW | `.gitignore:80` | Corrupted .gitignore line makes the android-sdk pattern a no-op |
| 6 | LOW | `backend/requirements.txt:1` | Pinned fastapi==0.110.1 forces Starlette version affected by CVE-2024-47874 |
| 7 | LOW | `backend/server.py:61` | CORS configured with wildcard origins plus allow_credentials=True |
| 8 | LOW | `frontend/app/index.tsx:6` | Frontend is a static-image stub that never calls the backend; leftover debug log of env var |

## Findings

### 1. [MEDIUM] Unresolvable private package pin 'emergentintegrations==0.1.0' — dependency-confusion vector

**Location:** `backend/requirements.txt:27`  
**Category:** supply-chain

emergentintegrations==0.1.0 does not exist on public PyPI (https://pypi.org/pypi/emergentintegrations/json returns 404; verified). It is only available from Emergent's private extra index. Any developer or CI running a plain 'pip install -r requirements.txt' fails today, and because the name is unclaimed on PyPI, an attacker can register 'emergentintegrations' (including version 0.1.0) and get arbitrary code execution on any machine that installs this file — with --extra-index-url, pip considers both indexes and the public package can win. Note the package is not even imported by backend/server.py, so the pin is pure risk with no benefit.

**Recommended fix:** Remove the unused emergentintegrations pin from requirements.txt; if it is ever needed, install it via an explicit --index-url pointing only at the private index (not --extra-index-url), or vendor it, and pin with a hash.

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/backend/requirements.txt:27 — "emergentintegrations==0.1.0" (the only line referencing it). /home/user/Cold-Email/backend/server.py:1-11 — full import list is fastapi, dotenv, starlette, motor, os, logging, pathlib, pydantic, typing, uuid, datetime; no emergentintegrations import, and server.py is the only Python module in backend/ (directory listing shows backend/ contains only requirements.txt and server.py). Live check performed by me: curl https://pypi.org/pypi/emergentintegrations/json → HTTP 404, and https://pypi.org/simple/emergentintegrations/ → HTTP 404 (name unclaimed on public PyPI as of 2026-07-20). Repo-wide grep for "extra-index|index-url|pip install" → no matches; no pip.conf, no Dockerfile, no CI yaml; /home/user/Cold-Email/.emergent/emergent.yml is only platform job metadata (env_image_name/job_id) and configures no package index.

</details>

### 2. [MEDIUM] Unauthenticated, unbounded write endpoint into MongoDB

**Location:** `backend/server.py:43`  
**Category:** security

POST /api/status accepts any request with no authentication, no rate limiting, and no length constraint on client_name (StatusCheckCreate declares it as a bare str, and uvicorn imposes no default request-body size limit), then inserts it into db.status_checks. Combined with the wildcard CORS policy and the fact that this backend is deployed publicly (preview URL found inlined in the committed Metro cache), anyone can pollute or fill the database with arbitrary documents up to MongoDB's 16MB doc limit, repeatedly — a storage-exhaustion / data-pollution vector. GET /api/status (line 50) then serves up to 1000 of those documents to any caller.

**Recommended fix:** Add authentication or at minimum rate limiting to the write endpoint, and constrain client_name with Field(max_length=...) in StatusCheckCreate.

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/backend/server.py:35-36 `class StatusCheckCreate(BaseModel): client_name: str` (bare str, no max_length); server.py:43-48 `@api_router.post("/status", ...) async def create_status_check(input: StatusCheckCreate): ... await db.status_checks.insert_one(status_obj.dict())` (no auth dependency); server.py:50-53 `await db.status_checks.find().to_list(1000)` returned to any caller; server.py:58-64 `allow_credentials=True, allow_origins=["*"]`; /home/user/Cold-Email/backend/requirements.txt (no auth/rate-limit middleware installed); `git ls-files` shows 11,603 committed frontend/.metro-cache files containing `https://minimal-hello-8.preview.emergentagent.com` (e.g. frontend/.metro-cache/cache/75/857823ae3d50c7b03cc712b59070ebbe1d44acf2390e38d89bafb1f63a190941cd3ac5)

</details>

### 3. [MEDIUM] app.json references splash asset that does not exist

**Location:** `frontend/app.json:31`  
**Category:** config

The expo-splash-screen plugin config points at ./assets/images/splash-icon.png, but no such file exists in frontend/assets/images/ — the directory contains splash-image.png instead (verified by listing the tracked assets). Any native build path that resolves the splash plugin (expo prebuild, EAS build) will fail with a missing-asset error.

**Recommended fix:** Change the plugin's image value to ./assets/images/splash-image.png, or add the missing splash-icon.png asset.

<details><summary>Verification evidence</summary>

app.json line 31: "image": "./assets/images/splash-icon.png" (inside the "expo-splash-screen" plugin entry at lines 28-36 of /home/user/Cold-Email/frontend/app.json). Directory listing of /home/user/Cold-Email/frontend/assets/images/ contains splash-image.png but no splash-icon.png. /home/user/Cold-Email/frontend/package.json line 30: "expo-splash-screen": "~31.0.13". No app.config.* file exists in /home/user/Cold-Email/frontend/.

</details>

### 4. [MEDIUM] 11,603 Metro build-cache files committed to git, leaking internal preview endpoints

**Location:** `frontend/metro.config.js:9`  
**Category:** secrets

metro.config.js places the Metro FileStore cache at frontend/.metro-cache inside the repo, and neither the root .gitignore nor frontend/.gitignore excludes .metro-cache (frontend/.gitignore only has '.metro-health-check*'). As a result 11,603 cache blobs are git-tracked (verified via git ls-files). Transform-cache blobs contain inlined environment values and internal infrastructure URLs: 70 occurrences of EXPO_PUBLIC_BACKEND_URL and the internal Emergent preview endpoints https://minimal-hello-8.preview.emergentagent.com and https://morning-welcome.stage-preview.emergentagent.com. Beyond the endpoint leak, any future env var inlined by Babel (keys, backend URLs) will be silently committed on the next 'Auto-generated changes' commit, and the repo is massively bloated.

**Recommended fix:** Add '.metro-cache/' to Cold-Email/frontend/.gitignore, run 'git rm -r --cached frontend/.metro-cache', and commit. Consider moving the cache out of the repo entirely (e.g., default tmp location or METRO_CACHE_ROOT outside the worktree).

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/frontend/metro.config.js:9-11 — "const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache'); config.cacheStores = [new FileStore({ root: path.join(root, 'cache') })];" | /home/user/Cold-Email/frontend/.gitignore — Metro section contains only ".metro-health-check*" | git ls-files frontend/.metro-cache | wc -l =&gt; 11603 (223 MB) | 70 grep hits for EXPO_PUBLIC_BACKEND_URL in frontend/.metro-cache | tracked blob frontend/.metro-cache/cache/00/7da67f... contains: "EXPO_PUBLIC_BACKEND_URL": "https://minimal-hello-8.preview.emergentagent.com" | git log: commit 9eae814 "Auto-generated changes"

</details>

### 5. [LOW] Corrupted .gitignore line makes the android-sdk pattern a no-op

**Location:** `.gitignore:80`  
**Category:** config

Line 80 reads 'android-sdk/ -e ' — the artifact of a botched shell append where the '-e' flag of echo landed inside the file. Because the pattern contains a literal ' -e', it matches nothing, so android-sdk/ is not actually ignored. The '# Environment files' / '*.env' lines that follow (81-83) were part of the same append but did land correctly, so env coverage works; only the android-sdk pattern is dead.

**Recommended fix:** Replace line 80 with 'android-sdk/' on its own line.

<details><summary>Verification evidence</summary>

Cold-Email/.gitignore:80 'android-sdk/ -e '; Cold-Email/.gitignore:81-83 '# Environment files' / '*.env' / '*.env.*'; empirical: 'git check-ignore -v android-sdk/testfile' → exit 1 (not ignored); 'git check-ignore -v .env' → matched at .gitignore:82:*.env

</details>

### 6. [LOW] Pinned fastapi==0.110.1 forces Starlette version affected by CVE-2024-47874

**Location:** `backend/requirements.txt:1`  
**Category:** security

fastapi==0.110.1 constrains starlette to &gt;=0.36.3,&lt;0.37.0. Starlette versions below 0.40.0 are vulnerable to CVE-2024-47874, a denial-of-service via unbounded memory consumption when parsing multipart form fields without a filename. python-multipart is installed (line 24), though no current endpoint parses forms, so the exposure is latent rather than active.

**Recommended fix:** Upgrade fastapi to a release that allows starlette &gt;=0.40.0 (fastapi &gt;=0.115.3).

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/backend/requirements.txt:1 'fastapi==0.110.1'; /home/user/Cold-Email/backend/requirements.txt:24 'python-multipart&gt;=0.0.9'; PyPI fastapi 0.110.1 requires_dist: 'starlette&lt;0.38.0,&gt;=0.37.2'; /home/user/Cold-Email/backend/server.py:3 'from starlette.middleware.cors import CORSMiddleware' (only starlette usage; no Form/File/UploadFile/request.form() anywhere in backend)

</details>

### 7. [LOW] CORS configured with wildcard origins plus allow_credentials=True

**Location:** `backend/server.py:61`  
**Category:** config

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]) combines wildcard origins with credentials. Starlette handles this combination by reflecting the request Origin on credentialed requests, so effectively every website on the internet is an allowed credentialed origin. The current endpoints (/api/status GET/POST) have no auth, so today the practical effect is that any site can read from and write unauthenticated records into the Mongo status_checks collection from a visitor's browser; the moment cookie- or session-based auth is added to this backend, this config becomes a full cross-site data-theft hole.

**Recommended fix:** Set allow_origins to the explicit frontend origin(s) (e.g., from an env var) and only enable allow_credentials when credentials are actually used.

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/backend/server.py:58-64 — app.add_middleware(CORSMiddleware, allow_credentials=True (line 60), allow_origins=["*"] (line 61), allow_methods=["*"], allow_headers=["*"]); /home/user/Cold-Email/backend/server.py:43-53 — unauthenticated POST/GET /api/status handlers writing/reading db.status_checks; /home/user/Cold-Email/backend/requirements.txt — fastapi==0.110.1 (Starlette 0.36-0.37, whose CORSMiddleware sets preflight_explicit_allow_origin = not allow_all_origins or allow_credentials and reflects the request Origin on cookie-bearing responses).

</details>

### 8. [LOW] Frontend is a static-image stub that never calls the backend; leftover debug log of env var

**Location:** `frontend/app/index.tsx:6`  
**Category:** quality

The only screen renders a static PNG. EXPO_PUBLIC_BACKEND_URL is read (line 3) but never used for any request — the app has zero integration with backend/server.py — and console.log prints the URL on every render, a debug leftover that ships in production bundles. The react-native-dotenv dependency in package.json is likewise unused (no babel.config.js configures it; Expo inlines EXPO_PUBLIC_* natively).

**Recommended fix:** Remove the console.log (and the unused react-native-dotenv dependency); wire the backend URL into an actual fetch when the app gains functionality.

<details><summary>Verification evidence</summary>

/home/user/Cold-Email/frontend/app/index.tsx:3 "const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;"; /home/user/Cold-Email/frontend/app/index.tsx:6 "console.log(EXPO_PUBLIC_BACKEND_URL, \"EXPO_PUBLIC_BACKEND_URL\");"; /home/user/Cold-Email/frontend/app/index.tsx:10-13 renders only require("../assets/images/app-image.png"); /home/user/Cold-Email/frontend/package.json:38 "react-native-dotenv": "^3.4.11"; find for babel.config* in frontend (excluding node_modules) returns nothing; app dir contains only index.tsx and +html.tsx; backend exists at /home/user/Cold-Email/backend/server.py with no frontend caller.

</details>
