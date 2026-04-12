#!/usr/bin/env python3
"""
CricHeroes SCC stats fetcher — intercepts XHR/fetch calls via CDP.
Captures the actual API responses with SCC-filtered data.
"""
import json, time, sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

TEAM_ID   = 7927431
TEAM_SLUG = 'sangria-cricket-club'
BASE_URL  = f'https://cricheroes.com/team-profile/{TEAM_ID}/{TEAM_SLUG}'

def make_driver():
    opts = Options()
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--window-size=1400,900')
    opts.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    return webdriver.Chrome(options=opts)

def get_api_responses(driver, url, wait_secs=12):
    """Navigate to URL, wait, then extract all XHR/fetch responses from perf logs."""
    driver.get(url)
    print(f"  Waiting {wait_secs}s for API calls to complete...")
    time.sleep(wait_secs)

    logs = driver.get_log('performance')
    responses = []

    for entry in logs:
        try:
            msg = json.loads(entry['message'])['message']
            method = msg.get('method', '')

            # Capture network response bodies
            if method == 'Network.responseReceived':
                resp = msg['params']['response']
                req_url = resp.get('url', '')
                if 'cricheroes' in req_url and not req_url.endswith(('.js', '.css', '.png', '.jpg', '.svg', '.ico', '.woff')):
                    req_id = msg['params']['requestId']
                    try:
                        body_result = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': req_id})
                        body_text = body_result.get('body', '')
                        if body_text and len(body_text) > 50:
                            try:
                                body_json = json.loads(body_text)
                                responses.append({'url': req_url, 'data': body_json})
                            except Exception:
                                responses.append({'url': req_url, 'data': body_text[:500]})
                    except Exception:
                        pass
        except Exception:
            pass

    return responses

def main():
    print("Starting Chrome with network logging...")
    driver = make_driver()

    # Enable network tracking via CDP
    driver.execute_cdp_cmd('Network.enable', {})

    all_responses = {}

    try:
        print(f"\nFetching leaderboard page...")
        lb_responses = get_api_responses(driver, f'{BASE_URL}/leaderboard', wait_secs=15)
        all_responses['leaderboard_page'] = lb_responses
        print(f"  Captured {len(lb_responses)} API responses")
        for r in lb_responses:
            print(f"    URL: {r['url']}")

        print(f"\nFetching stats page...")
        stats_responses = get_api_responses(driver, f'{BASE_URL}/stats', wait_secs=10)
        all_responses['stats_page'] = stats_responses
        print(f"  Captured {len(stats_responses)} API responses")
        for r in stats_responses:
            print(f"    URL: {r['url']}")

    finally:
        driver.quit()

    # Save everything
    with open('scc_cricheroes_data.json', 'w') as f:
        json.dump(all_responses, f, indent=2, default=str)

    print("\n✅ Done! Saved to scc_cricheroes_data.json")

    # Show any leaderboard/stats data found
    found_data = False
    for page, responses in all_responses.items():
        for r in responses:
            url = r['url']
            data = r['data']
            if isinstance(data, dict) and data.get('status') == True:
                print(f"\n🎯 Live data found at: {url}")
                d = data.get('data', {})
                if isinstance(d, list):
                    print(f"   Entries: {len(d)}")
                    if d:
                        print(f"   Sample: {json.dumps(d[0], default=str)[:300]}")
                        found_data = True
                elif isinstance(d, dict):
                    print(f"   Keys: {list(d.keys())}")

    if not found_data:
        print("\n⚠️  No live data found in API responses.")
        print("   The leaderboard data may require a logged-in session.")
        print("   Try Option B: Open DevTools > Network in your browser while logged in.")

if __name__ == '__main__':
    main()
