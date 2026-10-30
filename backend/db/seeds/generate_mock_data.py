"""Regenerate realistic fictional fixtures while preserving existing catalog identities.
Run from any directory: python backend/db/seeds/generate_mock_data.py
No database connection or third-party Python packages are required.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = (ROOT / 'sample_data.sql').read_text(encoding='utf-8')

def fields(line):
    result, start, depth, quoted, i = [], 0, 0, False, 0
    while i < len(line):
        char = line[i]
        if char == "'":
            if quoted and i + 1 < len(line) and line[i + 1] == "'":
                i += 2
                continue
            quoted = not quoted
        elif not quoted:
            if char in '([': depth += 1
            elif char in ')]': depth -= 1
            elif char == ',' and depth == 0:
                result.append(line[start:i].strip()); start = i + 1
        i += 1
    result.append(line[start:].strip())
    return result

def rows(table):
    section = source.split('INSERT INTO ' + table + ' (', 1)[1].split('ON CONFLICT', 1)[0]
    return [fields(line.rstrip(',;')[1:-1]) for line in section.splitlines() if line.startswith("('")]

def plain(value): return value[1:-1].replace("''", "'")
class SQL(str): pass

def literal(value):
    if isinstance(value, SQL): return str(value)
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)): return str(value)
    return "'" + str(value).replace("'", "''") + "'"

def insert(table, columns, values):
    updates = ', '.join(f'{c}=EXCLUDED.{c}' for c in columns if c != 'id')
    return f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n" + ',\n'.join('(' + ', '.join(map(literal, row)) + ')' for row in values) + f'\nON CONFLICT (id) DO UPDATE SET {updates}, updated_at=CURRENT_TIMESTAMP;\n'

import json
identities = json.loads((ROOT / 'catalog_identities.json').read_text())
old_areas = [[literal(x[0]), '', literal(x[1])] for x in identities['legacyLocations']]
old_businesses = [[literal(x[0]),literal(x[1])] for x in identities['venues']]
old_categories = [[literal(x[0]),'',literal(x[1])] for x in identities['categories']]
area_ids = [x[0] for x in identities['legacyLocations']]
business_ids = [x[0] for x in identities['venues']]
category_ids = [x[0] for x in identities['categories']]
experience_ids = identities['experiences']
schedule_ids = identities['schedules']
areas = [
    ('Rexburg','83440','America/Boise',43.8231,-111.7924,'ID'),
    ('Idaho Falls','83401','America/Denver',43.4917,-112.0339,'ID'),
    ('Boise','83702','America/Boise',43.615,-116.2023,'ID'),
    ('New York','10001','America/New_York',40.7128,-74.006,'NY'),
    ('Los Angeles','90012','America/Los_Angeles',34.0522,-118.2437,'CA'),
    ('Phoenix','85001','America/Phoenix',33.4484,-112.074,'AZ'),
    ('Tokyo','100-0001','Asia/Tokyo',35.6762,139.6503,'Tokyo'),
    ('Online','00000','UTC',None,None,None),
    ('Island Park','83429','America/Boise',44.4244,-111.3711,'ID'),
    ('West Bench','83704','America/Boise',43.615,-116.27,'ID'),
]
area_values=[]
for i,(name,postal,zone,lat,lon,region) in enumerate(areas):
    # Slugs retain legacy identities for compatibility; user-facing names are realistic.
    area_values.append([area_ids[i],name,plain(old_areas[i][2]),SQL('ARRAY['+literal(postal)+']::text[]'),zone,lat,lon,i!=9])
venue_names = ["Juniper Kitchen","Riverbend Café","Lantern Board Game Lounge","Orchard Music Hall","Cedar Street Cinema","Copper Mesa Studio","Paper Crane Workshop","Open Window Online Studio","Willow Community House","Bluebird Market","Foothill Climbing Club","Nightjar Coffee","Marigold Art Room","Stonebridge Theater","Desert Bloom Collective","Eastbank Social Club","Wildflower Recreation Center","Maple Lane Books","Canyon Table","Kite & Compass","The Foundry Stage","Birchwood Bowling","Little Lantern Playroom","Meadow Trail Outfitters","Northstar Learning Loft","Harborlight Listening Room","Sunroom Pottery","Tamarack Fitness Club","Common Ground Market","Moonlit Garden","Sagebrush Makerspace","Pinecone Picnic House","Café Étoile","Second Chapter Books","Creekside Pickleball","Ember & Oak Kitchen","Riverside Makers Hall","Vinyl & Verse","Aspen Music Room","Pocket Planet Arcade","Silver Screen Social","The Reading Nook","Fern & Field","Lakeside Workshop","Greenhouse Gathering","Summit Study Lounge","Cloud Nine Studio","Patchwork Community Hub","Golden Hour Gallery","Trailhead Social"]
business_values=[]
venue_area=[]
for i,old in enumerate(old_businesses):
    ai=area_ids.index(plain(old[1]));venue_area.append(ai)
    name,postal,zone,lat,lon,region=areas[ai]
    # Preserve one active venue without coordinates, and inactive venue/area controls.
    missing=i==2 or ai==7
    offset=((i//8)%5-2)*0.006
    business_values.append([business_ids[i],area_ids[ai],venue_names[i],"Fictional venue for Hyena's demonstration catalog; not a real business.",f'{101+i*7} Willow Lane',name,region,postal,None if missing else round(lat+offset,6),None if missing else round(lon-offset,6),None,None,None,i!=5 and ai!=9])
category_names=['Food','Music','Games','Family','Outdoors','Arts','Sports','College','Entertainment','Date Night','Learning','Markets','Community','Movies','Seasonal','Wellness']
category_values=[]
for i,name in enumerate(category_names):
    own=literal(category_ids[i]); normal=literal(name); demo=literal(name+' (Demo)')
    # Keep unrelated categories intact if the live database already uses a friendly name.
    display=SQL(f"CASE WHEN NOT EXISTS (SELECT 1 FROM categories WHERE name={normal} AND id<>{own}::uuid) THEN {normal} WHEN NOT EXISTS (SELECT 1 FROM categories WHERE name={demo} AND id<>{own}::uuid) THEN {demo} ELSE {literal(name+' (Demo '+category_ids[i][:8]+')')} END")
    category_values.append([category_ids[i],display,plain(old_categories[i][2]),None])
# Twelve natural activities per category, covering all prices and time windows.
titles=[
['Breakfast Taco Table','Soup & Sourdough Lunch','Street Food Tasting','Neighborhood Pizza Night','Pasta Making Social','Dessert After Dark','Late-Night Dumpling Bar','Coffee & Conversation','Weekend Brunch Club','Chef’s Seasonal Supper','Sunday Bake Sale','Community Recipe Exchange'],
['Acoustic Morning Session','Lunchtime Piano Lounge','Songwriters in the Round','Courtyard Jazz Evening','Indie Folk Showcase','Vinyl Listening Party','After-Hours Open Mic','Strings & Coffee','Local Bands Live','Chamber Music Social','Afternoon Choir Concert','Bring Your Own Instrument Jam'],
['Morning Chess Club','Lunch Break Card Games','Cooperative Game Afternoon','Strategy Table Night','Trivia & Team Challenges','Retro Arcade Social','Midnight Board Game Marathon','Quick-Play Game Lounge','Weekend Tabletop Meetup','Escape Room Team Night','Puzzle Swap','Learn a New Board Game'],
['Storytime & Sidewalk Chalk','Family Picnic Hour','Kids Craft Workshop','Family Game Night','Glow-in-the-Dark Mini Golf','Family Astronomy Evening','Stargazing Camp-In','Parent & Toddler Playtime','Weekend Puppet Show','Family Science Night','Community Toy Swap','Little Makers Afternoon'],
['Sunrise Trail Walk','Creekside Picnic Meetup','Nature Photography Walk','Evening River Stroll','Sunset Kayak Social','Night-Sky Observation','Moonlight Trail Meetup','Birdwatching Together','Weekend Nature Sketching','Outdoor Skills Workshop','Trail Stewardship Morning','Community Garden Walk'],
['Morning Sketch Club','Printmaking Lunch Lab','Watercolor Basics','Paint & Conversation','Clay Handbuilding Workshop','Figure Drawing Salon','After-Hours Art Studio','Gallery Sketch Meetup','Weekend Collage Workshop','Ceramics Glazing Social','Artists’ Print Exchange','Open Studio Afternoon'],
['Morning Stretch & Walk','Lunch Break Pickleball','Beginner Climbing Session','Community Volleyball','Indoor Soccer Social','Bowling Under the Lights','Late-Night Badminton','Drop-In Basketball','Weekend Disc Golf','Recreational Doubles Night','Gear Swap Meetup','Beginner Table Tennis'],
['Study Hall & Coffee','Lunch Break Campus Meetup','Budget Cooking Workshop','Campus Game Night','Student Poetry Circle','Finals Study Lounge','Late-Night Study Session','Peer Study Circle','Weekend Resume Workshop','Student Film Discussion','Textbook Exchange','Study Skills Workshop'],
['Morning Magic Showcase','Lunch Break Improv','Comedy Writing Workshop','Neighborhood Variety Show','Local Stand-Up Showcase','Interactive Mystery Night','After-Hours Improv Jam','Street Performer Showcase','Weekend Comedy Social','Storytelling on Stage','Talent Swap Showcase','Community Theater Warmup'],
['Coffee & Sketch Together','Picnic for Two','Partner Dance Basics','Candlelight Paint Night','Two-Person Pottery Session','Dessert & Jazz','Midnight Movie Pairing','Board Games for Two','Weekend Couples Cooking','Stargazing Date Night','Garden Walk for Two','Bookshop Date Afternoon'],
['Morning Language Exchange','Lunch Break Coding Circle','Intro to Photography','Creative Writing Workshop','Beginner Woodworking','Astronomy Conversation','Night Owl Coding Club','Practical Skills Exchange','Weekend Sewing Basics','Digital Art Workshop','Community Knowledge Swap','Everyday Science Lab'],
['Morning Makers Market','Lunch Break Book Market','Handmade Goods Pop-Up','Evening Artisan Market','Local Food Producers’ Market','Vintage Vinyl Market','Night Market Social','Community Swap Table','Weekend Craft Market','Seasonal Gift Market','Secondhand Book Exchange','Neighborhood Plant Market'],
['Morning Neighborhood Welcome','Community Lunch Table','Neighborhood Repair Café','Shared Supper Gathering','Volunteer Meet & Greet','Community Story Circle','Night Owl Conversation Table','Welcome Coffee Hour','Weekend Community Potluck','Neighborhood Planning Social','Clothing Exchange','Community Project Meetup'],
['Classic Cartoon Morning','Lunch Break Short Films','Film Discussion Circle','Independent Film Night','Documentary & Discussion','Classic Cinema Evening','Midnight Cult Movie','Local Short Film Showcase','Weekend Animation Club','Silent Film & Live Piano','Film Poster Exchange','Behind the Scenes Workshop'],
['Autumn Morning Walk','Seasonal Soup Lunch','Harvest Craft Workshop','Autumn Lantern Evening','Harvest Music Social','Fireside Story Night','Midnight Lantern Walk','Seasonal Nature Table','Weekend Harvest Market','Seasonal Wreath Workshop','Costume & Decoration Swap','Autumn Photography Circle'],
['Morning Breathwork','Lunch Break Mindfulness','Gentle Mobility Workshop','Evening Yoga Circle','Restorative Stretch Session','Sound Bath Evening','Late-Night Quiet Studio','Walking Meditation','Weekend Wellness Workshop','Guided Relaxation Night','Wellness Book Exchange','Open Mindfulness Hour'],
]
prices=[0,0.01,4.99,5,9.99,10,10.01,24.99,25,25.01,50,None]
times=[('08:00','10:00'),('11:00','13:00'),('16:00','18:00'),('17:00','21:00'),('18:00','22:00'),('21:00','23:00'),('23:00','02:00'),('',''),('18:00','20:00'),('20:00','22:00'),('09:00','11:00'),('14:00','16:00')]
local_venues=[i for i,a in enumerate(venue_area) if a==0 and i!=5]
active_venues=[i for i,a in enumerate(venue_area) if a not in [8,9] and i!=5 and i!=2]
experience_values=[];schedule_values=[];links=[];days=[];coverage=[]
def today(zone): return SQL(f"(CURRENT_TIMESTAMP AT TIME ZONE {literal(zone)})::date")
def day_expr(zone,offset): return SQL(f"({today(zone)} + {offset})")
for i,eid in enumerate(experience_ids):
    ci=(i//12)%16;variant=i%12
    vi=local_venues[(ci+variant)%len(local_venues)] if variant in [0,3,6,7,11] else active_venues[(ci*5+variant)%len(active_venues)]
    title=titles[ci][variant]
    price=prices[variant];active=True
    scenario='category-price-time matrix'
    if i>=192:
        extras=["Poetry & Café Conversation","Joe's Taco Table","Save 50% on Pottery Night","Indie_Film Discussion","Live Jazz: Questions & Answers?","The Long Way Home: An Evening of Stories, Music, and Community Conversation","Acoustic Evening","Acoustic Evening","Small-Group Chef’s Table","Community Craft Circle","Lunchtime Language Exchange","After-Hours Gallery Walk","Open Studio Reservation","Drop-In Badminton","Community Breakfast","Evening Film Salon","Sunset Photo Walk","Seasonal Cooking Workshop","Weekend Garden Club","Partner Dance Social","All-Day Reading Retreat","Spring Forward Yoga","Fall Back Listening Lounge","Leap Day Creative Workshop","Evening Sketchbook Club","Community Coffee Table","Sunrise Birdwatching","Late-Night Soup Kitchen","Quiet Study Evening","Repair & Reuse Workshop","Harvest Story Circle","After-Dark Astronomy","Community Wellness Meetup"]
        title=extras[i-192];scenario='edge case '+str(i-192)
        if i==192: vi=2 # Active venue without coordinates.
        if i==193: active=False
        if i==194: vi=5 # Inactive business.
        if i==195: vi=next(j for j,a in enumerate(venue_area) if a==9)
        if i==196: vi=next(j for j,a in enumerate(venue_area) if a==7)
        if i==200: price=249.99
        if i==201: price=None
        if i==202: price=0
    zone=areas[venue_area[vi]][2]
    start,end=times[variant];kind='WEEKLY';startdate=SQL(f"({today(zone)} - 30)");enddate=None;overnight=variant==6;weekdays=list(range(1,8))
    if variant==0:
        title=['Neighborhood Recipe Exchange','Community Music Stream','Community Puzzle Corner','Family Activity Pack','Self-Guided Nature Trail','Public Art Walk','Outdoor Fitness Circuit','Open Study Lounge','Community Story Exchange','Self-Guided Garden Walk','Community Language Exchange','Neighborhood Swap Table','Community Noticeboard Walk','Community Film Discussion','Harvest Scavenger Hunt','Self-Guided Mindfulness Walk'][ci]
        start,end='00:00','23:59';overnight=False
    if variant==7:
        kind='ONCE';weekdays=[]
        a=f"((CURRENT_TIMESTAMP AT TIME ZONE {literal(zone)}) - INTERVAL '30 minutes')"
        b=f"((CURRENT_TIMESTAMP AT TIME ZONE {literal(zone)}) + INTERVAL '45 minutes')"
        startdate=SQL(a+'::date');enddate=SQL(a+'::date');start=SQL(a+'::time');end=SQL(b+'::time');overnight=SQL(f'({b}::date > {a}::date)')
    elif variant in [8,9,10]:
        kind='ONCE';weekdays=[];offset={8:1,9:7,10:-1}[variant];startdate=day_expr(zone,offset);enddate=startdate
    if i>=192:
        edge=i-192
        if edge==14: weekdays=[1,3,5]
        if edge==15: kind='WEEKLY';startdate=day_expr(zone,7);enddate=None;weekdays=[2,4,6];start,end='18:00','20:00';overnight=False
        if edge==16: kind='WEEKLY';startdate=day_expr(zone,-30);enddate=day_expr(zone,-1);weekdays=list(range(1,8));start,end='17:00','19:00';overnight=False
        if edge==17: kind='WEEKLY';startdate=day_expr(zone,-7);enddate=today(zone);weekdays=list(range(1,8));start,end='16:00','18:00';overnight=False
        if edge==20: kind='WEEKLY';weekdays=list(range(1,8));start,end='00:00','23:59';overnight=False
        if edge in [21,22,23]:
            kind='ONCE';weekdays=[];startdate=SQL("DATE '"+{21:'2027-03-14',22:'2026-11-01',23:'2028-02-29'}[edge]+"'");enddate=startdate
            start,end={21:('02:15','04:00'),22:('01:15','02:15'),23:('18:00','20:00')}[edge];overnight=False
            # DST probes must use a zone that observes the US transition.
            vi=local_venues[0];zone='America/Boise'
    offer='Free admission' if price==0 else 'Pricing announced soon' if price is None else f'${price:.2f} per person'
    description=f"Join {title.lower()} at {venue_names[vi]}. A welcoming small-group experience with time to meet others and try something new. Mock listing for development; not a real event or offer."
    if eid not in schedule_ids: active=False
    experience_values.append([eid,business_ids[vi],title,description,['EVENT','ACTIVITY','OFFER','SPECIAL'][variant%4],price,'USD' if price is not None else None,offer,'Advance booking recommended.' if variant in [4,8,9] else None,None,None,active])
    if eid not in schedule_ids: continue
    links.append((eid,category_ids[ci]))
    # Preserve the Food identity used by rollback-only constraint tests.
    if ci!=0 and i==0: links.append((eid,category_ids[0]))
    if i % 4 == 0 or i>=192: links.append((eid,category_ids[(ci+3)%16]))
    sid=schedule_ids[eid];schedule_values.append([sid,eid,kind,startdate,enddate,start,end,overnight,zone,start=='00:00' and end=='23:59'])
    days.extend((sid,d) for d in weekdays)
    coverage.append((eid,ci,variant,scenario))

catalog='-- Fictional demonstration catalog. All venues and offers are invented.\n-- Run the entire script in DBeaver. Stable IDs preserve references; reruns refresh relative dates.\n-- Only the existing mock catalog IDs are updated. No users or sessions are changed here.\nBEGIN;\nSET LOCAL TIME ZONE \'UTC\';\n'
catalog+=insert('businesses',['id','time_zone','name','description','address','city','region','postal_code','latitude','longitude','phone','website_url','image_url','is_active'],[[v[0],areas[area_ids.index(v[1])][2],*v[2:]] for v in business_values])
catalog+=insert('categories',['id','name','slug','icon_key'],category_values)
catalog+=insert('experiences',['id','business_id','title','description','type','price_amount','currency','price_label','requirements','image_url','source_url','is_active'],experience_values)
catalog+='DELETE FROM experience_categories WHERE experience_id IN ('+', '.join(map(literal,experience_ids))+');\n'
catalog+='INSERT INTO experience_categories (experience_id, category_id) VALUES\n'+',\n'.join('('+', '.join(map(literal,x))+')' for x in sorted(set(links)))+'\nON CONFLICT DO NOTHING;\n'
catalog+=insert('experience_schedules',['id','experience_id','kind','start_date','end_date','start_time','end_time','ends_next_day','time_zone','all_day'],schedule_values)
catalog+='DELETE FROM experience_schedule_days WHERE schedule_id IN ('+', '.join(literal(schedule_ids[x]) for x in experience_ids if x in schedule_ids)+');\n'
catalog+='INSERT INTO experience_schedule_days (schedule_id, iso_weekday) VALUES\n'+',\n'.join('('+', '.join(map(literal,x))+')' for x in days)+'\nON CONFLICT DO NOTHING;\n'
(ROOT/'refresh_mock_catalog.sql').write_text(catalog+'COMMIT;\n',encoding='utf-8')
# Retain the original public account/session fixtures and consistency checks for fresh test databases.
tail='INSERT INTO users ('+source.split('INSERT INTO users (',1)[1]
tail='\n'.join(line for line in tail.splitlines() if 'FROM discovery_areas WHERE id IN' not in line)
tail=tail.replace("SELECT 'discovery_areas' AS table_name, count(*) AS rows FROM discovery_areas UNION ALL SELECT 'businesses', count(*) FROM businesses","SELECT 'businesses' AS table_name, count(*) AS rows FROM businesses")+'\n'
(ROOT/'sample_data.sql').write_text(catalog.replace('-- Only the existing mock catalog IDs are updated. No users or sessions are changed here.','-- Full fixture set: includes public demo accounts/sessions; use refresh_mock_catalog.sql for catalog-only updates.')+tail,encoding='utf-8')
print('Generated 225 experiences, 50 venues, 16 populated categories; preserved all catalog IDs.')
