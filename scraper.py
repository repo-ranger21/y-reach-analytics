"""
Y-Reach / RIEC-Reach Analytics · scraper.py
Scrapes RI Foundation, Grants.gov, Champlin Foundation,
and RI DLT Real Jobs RI.
Outputs a normalized grants.json. Retains prior data on failure.
 
Run locally:  python scraper.py
Run via CI:   see .github/workflows/scrape.yml
"""
 
import json
import logging
import re
import time
from datetime import datetime, date
from pathlib import Path
 
import requests
from bs4 import BeautifulSoup
 
# ── Config ────────────────────────────────────────────────────
OUTPUT_FILE   = Path(__file__).parent / "grants.json"
REQUEST_DELAY = 1.5
HEADERS       = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Y-Reach-Grant-Bot/1.0; "
        "+https://github.com/your-org/y-reach-analytics)"
    )
}
 
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("y-reach-scraper")
 
 
# ═══════════════════════════════════════════════════════════════
# KEYWORD → DEMOGRAPHIC TAG MAP
# ═══════════════════════════════════════════════════════════════
DEMOGRAPHIC_TAG_MAP = {
    "low-income": [
        "low-income", "low income", "at-risk", "at risk",
        "underprivileged", "underserved", "economically disadvantaged",
        "poverty", "subsidized", "financial assistance", "free or reduced",
        "title i", "snap", "medicaid",
    ],
    "youth": [
        "youth", "children", "child", "teen", "teenager", "adolescent",
        "after-school", "after school", "summer program", "k-12",
        "elementary", "middle school", "high school", "young people",
        "ages 0", "ages 5", "ages 6", "ages 12", "ages 13", "ages 18",
    ],
    "senior": [
        "senior", "elderly", "older adult", "age 60", "age 65",
        "aging population", "retirement",
    ],
    "disability": [
        "disability", "disabilities", "disabled", "special needs",
        "adaptive", "accessibility",
    ],
    "health-wellness": [
        "health", "wellness", "mental health", "nutrition", "obesity",
        "physical activity", "fitness", "recreation",
    ],
    "community-development": [
        "community development", "neighborhood", "civic", "non-profit",
        "capacity building", "workforce", "job training",
    ],
    # ── New tags for RIEC / workforce-education orgs ──────────
    "healthcare-edu": [
        "cna", "certified nursing assistant", "emt", "emergency medical",
        "healthcare training", "healthcare workforce", "medical assistant",
        "phlebotomy", "nurse aide", "nursing education", "clinical training",
        "allied health", "health careers", "caregiver training",
        "patient care technician", "home health aide",
    ],
    "workforce-dev": [
        "workforce development", "job readiness", "vocational",
        "real jobs", "career pathway", "sectoral training",
        "incumbent worker", "upskilling", "reskilling",
        "industry-recognized credential", "earn and learn",
        "apprenticeship", "certificate program", "job placement",
    ],
    "adult-ed": [
        "adult education", "adult learner", "ged", "hse",
        "high school equivalency", "esl", "english as a second language",
        "basic skills", "adult literacy", "continuing education",
        "community college", "non-traditional student",
    ],
}
 
def extract_demographics(text: str) -> list[str]:
    text_lower = text.lower()
    matched = []
    for tag, keywords in DEMOGRAPHIC_TAG_MAP.items():
        if any(kw in text_lower for kw in keywords):
            matched.append(tag)
    return matched if matched else ["general"]
 
 
# ═══════════════════════════════════════════════════════════════
# SHARED UTILITIES
# ═══════════════════════════════════════════════════════════════
def safe_get(url: str, **kwargs) -> requests.Response | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, **kwargs)
        resp.raise_for_status()
        return resp
    except requests.RequestException as e:
        log.warning("GET failed for %s — %s", url, e)
        return None
 
def parse_amount(text: str) -> tuple[int, int]:
    amounts = [
        int(n.replace(",", ""))
        for n in re.findall(r"\$?([\d,]{4,})", text.replace(" ", ""))
    ]
    if len(amounts) >= 2:
        return min(amounts), max(amounts)
    if len(amounts) == 1:
        return (0, amounts[0]) if "up to" in text.lower() else (amounts[0], amounts[0])
    return (0, 0)
 
def today_str() -> str:
    return date.today().isoformat()
 
def slug(text: str, source_id: str, index: int) -> str:
    clean = re.sub(r"[^a-z0-9]+", "_", text.lower())[:40].strip("_")
    return f"{source_id}_{clean}_{index:03d}"
 
 
# ═══════════════════════════════════════════════════════════════
# SCRAPER 1 — Rhode Island Foundation
# ═══════════════════════════════════════════════════════════════
def scrape_ri_foundation() -> list[dict]:
    SOURCE = "rif"
    BASE   = "https://www.rifoundation.org"
    START  = f"{BASE}/grants-support/grants"
    grants = []
 
    log.info("[RI Foundation] Starting scrape …")
    resp = safe_get(START)
    if not resp:
        log.warning("[RI Foundation] Unreachable — skipping.")
        return grants
 
    soup  = BeautifulSoup(resp.text, "html.parser")
    pages = [START]
 
    for a in soup.select("a[href*='page='], a.next, a[rel='next']"):
        href = a.get("href", "")
        full = href if href.startswith("http") else BASE + href
        if full not in pages:
            pages.append(full)
 
    for page_url in pages[:5]:
        if page_url != START:
            time.sleep(REQUEST_DELAY)
            resp = safe_get(page_url)
            if not resp:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
 
        cards = (
            soup.select("article.grant-item")
            or soup.select("div.grant-listing")
            or soup.select("div.field-item")
            or soup.select("li.views-row")
            or soup.select("div.view-content > div")
        )
 
        for i, card in enumerate(cards):
            title_el = card.find(["h2", "h3", "h4", "a"])
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if len(title) < 5:
                continue
 
            link_el  = card.find("a", href=True)
            url      = (BASE + link_el["href"]) if link_el and not link_el["href"].startswith("http") else (link_el["href"] if link_el else START)
            desc_el  = card.find("p") or card.find("div", class_=re.compile(r"desc|summary|body"))
            desc     = desc_el.get_text(strip=True) if desc_el else title
            amin, amax = parse_amount(card.get_text())
 
            dl_match = re.search(
                r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}",
                card.get_text(), re.IGNORECASE
            )
            deadline = ""
            if dl_match:
                try:
                    deadline = datetime.strptime(
                        re.sub(r"\s+", " ", dl_match.group()), "%B %d %Y"
                    ).date().isoformat()
                except ValueError:
                    deadline = ""
 
            grants.append({
                "id":                   slug(title, SOURCE, i),
                "title":                title,
                "funder":               "Rhode Island Foundation",
                "amount_min":           amin,
                "amount_max":           amax,
                "deadline":             deadline,
                "url":                  url,
                "target_demographics":  extract_demographics(f"{title} {desc}"),
                "min_subsidized_youth": 10 if "youth" in desc.lower() else 0,
                "min_unique_members":   25,
                "geographic_scope":     "state",
                "description":          desc[:300],
                "last_updated":         today_str(),
            })
        time.sleep(REQUEST_DELAY)
 
    log.info("[RI Foundation] %d grants collected.", len(grants))
    return grants
 
 
# ═══════════════════════════════════════════════════════════════
# SCRAPER 2 — Grants.gov (Education / Youth Services)
# ═══════════════════════════════════════════════════════════════
def scrape_grants_gov() -> list[dict]:
    SOURCE = "ggov"
    API    = "https://apply07.grants.gov/grantsws/rest/opportunities/search/"
    grants = []
 
    log.info("[Grants.gov] Starting API fetch …")
    payload = {
        "keyword":        "youth services community recreation workforce training",
        "oppStatuses":    "forecasted|posted",
        "agencies":       "ED",
        "rows":           25,
        "startRecordNum": 0,
    }
 
    resp = safe_get(API, params=payload)
    if not resp:
        log.warning("[Grants.gov] API unreachable — skipping.")
        return grants
 
    try:
        data = resp.json()
    except ValueError:
        log.warning("[Grants.gov] Non-JSON response — skipping.")
        return grants
 
    opportunities = data.get("oppHits", [])
    log.info("[Grants.gov] %d opportunities returned.", len(opportunities))
 
    for i, opp in enumerate(opportunities):
        title = opp.get("title", "").strip()
        if not title:
            continue
 
        desc     = opp.get("synopsis", opp.get("description", title))
        agency   = opp.get("agencyName", "U.S. Department of Education")
        url      = f"https://www.grants.gov/search-results-detail/{opp.get('id', '')}"
        deadline = opp.get("closeDate", "")
        if deadline:
            try:
                deadline = datetime.strptime(deadline, "%m/%d/%Y").date().isoformat()
            except ValueError:
                deadline = ""
 
        grants.append({
            "id":                   slug(title, SOURCE, i),
            "title":                title,
            "funder":               agency,
            "amount_min":           int(opp.get("awardFloor",   0) or 0),
            "amount_max":           int(opp.get("awardCeiling", 0) or 0),
            "deadline":             deadline,
            "url":                  url,
            "target_demographics":  extract_demographics(f"{title} {desc}"),
            "min_subsidized_youth": 20,
            "min_unique_members":   50,
            "geographic_scope":     "national",
            "description":          str(desc)[:300],
            "last_updated":         today_str(),
        })
 
    log.info("[Grants.gov] %d grants normalized.", len(grants))
    return grants
 
 
# ═══════════════════════════════════════════════════════════════
# SCRAPER 3 — Champlin Foundation
# ═══════════════════════════════════════════════════════════════
def scrape_champlin() -> list[dict]:
    SOURCE = "champ"
    BASE   = "https://www.champlinfoundation.org"
    START  = f"{BASE}/apply"
    grants = []
 
    log.info("[Champlin] Starting scrape …")
    resp = safe_get(START)
    if not resp:
        log.warning("[Champlin] Unreachable — skipping.")
        return grants
 
    soup    = BeautifulSoup(resp.text, "html.parser")
    headers = soup.find_all(["h2", "h3"])
 
    current_year = date.today().year
    spring_dl    = f"{current_year}-04-01"
    fall_dl      = f"{current_year}-10-01"
    today        = date.today().isoformat()
    deadline     = fall_dl if today > spring_dl else spring_dl
 
    for i, header in enumerate(headers):
        title = header.get_text(strip=True)
        if len(title) < 6 or title.lower() in ("apply", "menu", "contact"):
            continue
 
        desc_parts = []
        for sib in header.find_next_siblings():
            if sib.name in ["h2", "h3"]:
                break
            text = sib.get_text(strip=True)
            if text:
                desc_parts.append(text)
        desc = " ".join(desc_parts)[:300]
 
        amt_text   = header.find_parent().get_text() if header.find_parent() else title
        amin, amax = parse_amount(amt_text)
 
        grants.append({
            "id":                   slug(title, SOURCE, i),
            "title":                title,
            "funder":               "The Champlin Foundation",
            "amount_min":           amin if amin else 5000,
            "amount_max":           amax if amax else 100000,
            "deadline":             deadline,
            "url":                  START,
            "target_demographics":  extract_demographics(f"{title} {desc}"),
            "min_subsidized_youth": 0,
            "min_unique_members":   10,
            "geographic_scope":     "state",
            "description":          desc if desc else title,
            "last_updated":         today_str(),
        })
 
    log.info("[Champlin] %d grant sections collected.", len(grants))
    return grants
 
 
# ═══════════════════════════════════════════════════════════════
# SCRAPER 4 — RI DLT Real Jobs RI
# URL: https://dlt.ri.gov/employers/real-jobs-ri
#
# Real Jobs RI is a sector-based workforce training program
# administered by the RI Department of Labor and Training.
# The page lists active partnership cohorts and RFP cycles.
# We target: Healthcare, Education, and Technical sectors —
# the three most relevant to RIEC's CNA/EMT pipeline.
# ═══════════════════════════════════════════════════════════════
def scrape_real_jobs_ri() -> list[dict]:
    SOURCE       = "rjri"
    BASE         = "https://dlt.ri.gov"
    START        = f"{BASE}/employers/real-jobs-ri"
    # Secondary page targets sector-specific RFP announcements
    RFP_PAGE     = f"{BASE}/workforce-development/real-jobs-ri/funding-opportunities"
    grants       = []
    RIEC_SECTORS = {"health", "healthcare", "medical", "cna", "emt",
                    "education", "training", "workforce", "care"}
 
    log.info("[Real Jobs RI] Starting scrape …")
 
    for page_url in [START, RFP_PAGE]:
        time.sleep(REQUEST_DELAY)
        resp = safe_get(page_url)
        if not resp:
            log.warning("[Real Jobs RI] Unreachable: %s — skipping.", page_url)
            continue
 
        soup = BeautifulSoup(resp.text, "html.parser")
 
        # DLT uses Drupal CMS — target content region then find
        # header-anchored sections or table rows listing grant cycles
        content = (
            soup.find("div", class_=re.compile(r"field--body|content|main"))
            or soup.find("main")
            or soup
        )
 
        # ── Strategy A: structured table rows (RFP listing pages) ──
        rows = content.select("table tr") if content else []
        for i, row in enumerate(rows[1:], start=0):   # skip header row
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
 
            title    = cells[0].get_text(strip=True)
            desc_raw = " ".join(c.get_text(strip=True) for c in cells)
            if not title or len(title) < 6:
                continue
 
            link_el  = row.find("a", href=True)
            url      = (BASE + link_el["href"]) if link_el and not link_el["href"].startswith("http") else (link_el["href"] if link_el else START)
            amin, amax = parse_amount(desc_raw)
 
            dl_match = re.search(r"\d{1,2}/\d{1,2}/\d{4}", desc_raw)
            deadline = ""
            if dl_match:
                try:
                    deadline = datetime.strptime(dl_match.group(), "%m/%d/%Y").date().isoformat()
                except ValueError:
                    deadline = ""
 
            grants.append({
                "id":                   slug(title, SOURCE, i),
                "title":                title,
                "funder":               "RI Department of Labor and Training",
                "amount_min":           amin,
                "amount_max":           amax,
                "deadline":             deadline,
                "url":                  url,
                "target_demographics":  extract_demographics(f"{title} {desc_raw}"),
                "min_subsidized_youth": 0,
                "min_unique_members":   5,
                "geographic_scope":     "state",
                "description":          desc_raw[:300],
                "last_updated":         today_str(),
            })
 
        # ── Strategy B: section headers (programme overview pages) ──
        if not grants:
            headers = content.find_all(["h2", "h3", "h4"]) if content else []
            for i, header in enumerate(headers):
                title = header.get_text(strip=True)
                # Only keep sections relevant to RIEC's focus areas
                title_words = set(title.lower().split())
                if not title_words & RIEC_SECTORS and len(title) < 8:
                    continue
 
                desc_parts = []
                for sib in header.find_next_siblings():
                    if sib.name in ["h2", "h3", "h4"]:
                        break
                    desc_parts.append(sib.get_text(strip=True))
                desc = " ".join(desc_parts)[:300]
 
                link_el  = header.find("a", href=True) or header.find_next("a", href=True)
                url      = (BASE + link_el["href"]) if link_el and not link_el["href"].startswith("http") else (link_el["href"] if link_el else START)
                amin, amax = parse_amount(desc)
 
                # Real Jobs RI runs annual RFP cycles; estimate next deadline
                current_year = date.today().year
                rfp_dl = f"{current_year}-06-30"   # typical summer close
                if date.today().isoformat() > rfp_dl:
                    rfp_dl = f"{current_year + 1}-06-30"
 
                grants.append({
                    "id":                   slug(title, SOURCE, i),
                    "title":                f"Real Jobs RI — {title}",
                    "funder":               "RI Department of Labor and Training",
                    "amount_min":           amin if amin else 10000,
                    "amount_max":           amax if amax else 300000,
                    "deadline":             rfp_dl,
                    "url":                  url,
                    "target_demographics":  extract_demographics(f"{title} {desc}"),
                    "min_subsidized_youth": 0,
                    "min_unique_members":   5,
                    "geographic_scope":     "state",
                    "description":          desc if desc else title,
                    "last_updated":         today_str(),
                })
 
    log.info("[Real Jobs RI] %d grants collected.", len(grants))
    return grants
 
 
# ═══════════════════════════════════════════════════════════════
# FALLBACK SEED DATA
# Includes 2 new RIEC-specific healthcare/workforce seeds.
# ═══════════════════════════════════════════════════════════════
SEED_GRANTS = [
    # ── Existing YMCA/general seeds ───────────────────────────
    {
        "id":                   "seed_ys_fund_001",
        "title":                "Youth Sports & Recreation Grant",
        "funder":               "Rhode Island Foundation",
        "amount_min":           5000,
        "amount_max":           25000,
        "deadline":             f"{date.today().year}-11-01",
        "url":                  "https://www.rifoundation.org/grants-support/grants",
        "target_demographics":  ["youth", "low-income", "health-wellness"],
        "min_subsidized_youth": 15,
        "min_unique_members":   30,
        "geographic_scope":     "state",
        "description":          "Supports RI nonprofits providing youth sports and recreation programming to underserved communities.",
        "last_updated":         today_str(),
    },
    {
        "id":                   "seed_21cclc_001",
        "title":                "21st Century Community Learning Centers",
        "funder":               "U.S. Department of Education",
        "amount_min":           50000,
        "amount_max":           400000,
        "deadline":             f"{date.today().year}-08-15",
        "url":                  "https://www.grants.gov/search-results-detail/21CCLC",
        "target_demographics":  ["youth", "low-income", "community-development"],
        "min_subsidized_youth": 50,
        "min_unique_members":   100,
        "geographic_scope":     "national",
        "description":          "Federal funding for after-school, before-school, and summer programs for students in low-income Title I schools.",
        "last_updated":         today_str(),
    },
    {
        "id":                   "seed_champ_capital_001",
        "title":                "Champlin Foundation Capital Grant",
        "funder":               "The Champlin Foundation",
        "amount_min":           10000,
        "amount_max":           100000,
        "deadline":             f"{date.today().year}-10-01",
        "url":                  "https://www.champlinfoundation.org/apply",
        "target_demographics":  ["community-development", "youth", "health-wellness"],
        "min_subsidized_youth": 0,
        "min_unique_members":   20,
        "geographic_scope":     "state",
        "description":          "Capital grants for RI nonprofits for facility improvements, equipment, and infrastructure serving the public.",
        "last_updated":         today_str(),
    },
    {
        "id":                   "seed_snap_ed_001",
        "title":                "SNAP-Ed Community Nutrition Program",
        "funder":               "USDA Food & Nutrition Service",
        "amount_min":           10000,
        "amount_max":           75000,
        "deadline":             f"{date.today().year}-09-30",
        "url":                  "https://snaped.fns.usda.gov/",
        "target_demographics":  ["low-income", "youth", "health-wellness"],
        "min_subsidized_youth": 10,
        "min_unique_members":   25,
        "geographic_scope":     "national",
        "description":          "Funds nutrition education and obesity prevention programs for SNAP-eligible populations.",
        "last_updated":         today_str(),
    },
    # ── NEW: RIEC Healthcare Workforce seeds ──────────────────
    {
        "id":                   "seed_rjri_healthcare_001",
        "title":                "Real Jobs RI — Healthcare Workforce Partnership",
        "funder":               "RI Department of Labor and Training",
        "amount_min":           25000,
        "amount_max":           300000,
        "deadline":             f"{date.today().year}-06-30",
        "url":                  "https://dlt.ri.gov/employers/real-jobs-ri",
        "target_demographics":  ["healthcare-edu", "workforce-dev", "adult-ed", "low-income"],
        "min_subsidized_youth": 0,
        "min_unique_members":   5,
        "geographic_scope":     "state",
        "description":          "Real Jobs RI sector-based workforce training grants for healthcare partnerships. Funds CNA, EMT, Medical Assistant, and allied health credential training programs for adult learners in Rhode Island.",
        "last_updated":         today_str(),
    },
    {
        "id":                   "seed_hrsa_workforce_001",
        "title":                "HRSA Health Workforce Development Program",
        "funder":               "U.S. Health Resources & Services Administration",
        "amount_min":           75000,
        "amount_max":           500000,
        "deadline":             f"{date.today().year}-07-15",
        "url":                  "https://www.hrsa.gov/grants/find-funding",
        "target_demographics":  ["healthcare-edu", "workforce-dev", "low-income", "community-development"],
        "min_subsidized_youth": 0,
        "min_unique_members":   10,
        "geographic_scope":     "national",
        "description":          "Federal funding for community-based organizations providing healthcare workforce training, including CNA, EMT, and allied health pipeline programs targeting underserved populations and workforce shortages.",
        "last_updated":         today_str(),
    },
]
 
 
# ═══════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════
def load_existing() -> list[dict]:
    if OUTPUT_FILE.exists():
        try:
            with OUTPUT_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
                log.info("Loaded %d existing grants as fallback.", len(data))
                return data
        except (json.JSONDecodeError, OSError) as e:
            log.warning("Could not read existing grants.json — %s", e)
    return list(SEED_GRANTS)
 
def deduplicate(grants: list[dict]) -> list[dict]:
    seen = {}
    for g in grants:
        seen[g["id"]] = g
    return list(seen.values())
 
def main():
    log.info("═══ Y-Reach / RIEC-Reach Grant Scraper starting ═══")
    existing = load_existing()
    fresh: list[dict] = []
 
    for scraper_fn in [
        scrape_ri_foundation,
        scrape_grants_gov,
        scrape_champlin,
        scrape_real_jobs_ri,   # ← new
    ]:
        try:
            results = scraper_fn()
            fresh.extend(results)
        except Exception as e:  # noqa: BLE001
            log.error("Scraper %s crashed — %s", scraper_fn.__name__, e)
 
    if not fresh:
        log.warning("All scrapers returned 0 results. Retaining existing grants.json.")
        return
 
    combined = deduplicate(list(SEED_GRANTS) + existing + fresh)
    combined.sort(key=lambda g: g.get("deadline", "9999"))
 
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
 
    log.info("═══ Scrape complete. %d grants written to %s ═══", len(combined), OUTPUT_FILE)
 
if __name__ == "__main__":
    main()
