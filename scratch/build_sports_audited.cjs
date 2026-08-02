const fs = require('fs');

const sportsPath = 'C:/dev/gw-quiz-trainer/src/data/questions/sports.json';
const sports = JSON.parse(fs.readFileSync(sportsPath, 'utf8'));

const updates = [
  // 0 - 9
  {
    tip: "Remember that Bradman needed just 4 runs in his final Test innings at The Oval in 1948 to average 100.00, but fell for a second-ball duck to Eric Hollies.",
    explanation: "Sir Donald Bradman retired with a Test batting average of 99.94, widely regarded as the greatest statistical achievement by any athlete in major sport. Across 52 Test matches and 80 innings from 1928 to 1948, Bradman scored 6,996 runs with 29 centuries."
  },
  {
    tip: "Think of 'The Machine'—Jock McHale's Collingwood squad remains the only side in VFL/AFL history to complete a four-peat (1927, 1928, 1929, 1930).",
    explanation: "Coached by hall-of-famer Jock McHale, Collingwood dominated Australian rules football in the late 1920s. Known as 'The Machine' for their ruthless tactical discipline and team depth, they won four consecutive VFL premierships."
  },
  {
    tip: "Leigh Matthews adopted the famous movie tagline from Predator ('If it bleeds, we can kill it') to break Essendon's aura and spark this 2001-2003 three-peat.",
    explanation: "Under coach Leigh Matthews and skipper Michael Voss, the Brisbane Lions created a modern AFL dynasty. They won three straight Grand Finals against Essendon (2001) and Collingwood (2002, 2003) with a legendary midfield featuring Voss, Simon Black, Jason Akermanis, and Nigel Lappin."
  },
  {
    tip: "Alastair Clarkson's innovative 'Clarkson Cluster' zone defense powered the Hawks to Grand Final victories over Fremantle (2013), Sydney (2014), and West Coast (2015).",
    explanation: "Hawthorn became the second club in the AFL era to accomplish a premiership three-peat. Captained by Luke Hodge, the Hawks combined relentless pressure, elite foot skills, and tactical flexibility across three consecutive dominant September campaigns."
  },
  {
    tip: "Norm Smith's legendary status is enshrined in the Grand Final best-on-ground medal named after him; his Demons won five flags in six years during the 1950s.",
    explanation: "Melbourne Football Club dominated Australian rules football under coach Norm Smith during its 1950s golden era. The Demons secured three consecutive VFL premierships from 1955 to 1957, defeating Collingwood in 1955 and 1956, and Essendon in 1957."
  },
  {
    tip: "Founded in 1877 by the All England Club, this tournament retains classic grass courts, strict all-white attire rules, and signature strawberries and cream.",
    explanation: "The Lawn Tennis Championships at Wimbledon, held in SW19 London, is the world's oldest tennis tournament. It remains the sport's most prestigious major, played on traditional perennial ryegrass courts."
  },
  {
    tip: "Roland Garros was a pioneering French aviator who performed the first non-stop flight across the Mediterranean Sea in 1913 before fighting in World War I.",
    explanation: "Staged at Stade Roland Garros in Paris, the French Open is tennis's premier clay-court championship. The slow, high-bouncing red clay (terre battue) severely tests players' endurance, sliding technique, and topspin heavy groundstrokes."
  },
  {
    tip: "Held every January at Melbourne Park, players compete for the Norman Brookes Challenge Cup (men's) and Daphne Akhurst Memorial Cup (women's) in summer heat.",
    explanation: "The Australian Open opens the annual Grand Slam calendar each January. Dubbed 'The Happy Slam' by Roger Federer, it moved from grass at Kooyong to purpose-built hardcourts at Flinders Park (now Melbourne Park) in 1988."
  },
  {
    tip: "Located at Flushing Meadows in Queens, Arthur Ashe Stadium is the world's largest tennis venue, seating over 23,000 enthusiastic fans under night lights.",
    explanation: "The US Open concludes the Grand Slam season each late August and September. Renowned for its fast acrylic hard courts, energetic electric atmosphere, night sessions, and final-set tiebreakers, it attracts global crowds to New York City."
  },
  {
    tip: "IOC President Juan Antonio Samaranch famously declared during the closing ceremony that Sydney had presented 'the best Olympic Games ever'.",
    explanation: "The 2000 Summer Olympics in Sydney ran from September 15 to October 1, hosting over 10,000 athletes across 199 nations. Staged at Sydney Olympic Park, the Games were praised worldwide for flawless organization, passionate crowds, and iconic sporting triumphs."
  },

  // 10 - 19
  {
    tip: "Known as 'The Friendly Games', Melbourne 1956 introduced the tradition of athletes entering the stadium together in mixed country order during closing ceremonies.",
    explanation: "The XVI Olympiad in Melbourne was the first Olympic Games staged in the Southern Hemisphere. Because of strict Australian quarantine regulations for horses, equestrian competitions took place five months earlier in Stockholm, Sweden."
  },
  {
    tip: "The Serbian superstar achieved a career 'Super Slam' by winning all four majors, ATP Finals, and Paris 2024 Olympic singles gold, breaking Federer and Nadal's records.",
    explanation: "Novak Djokovic holds the all-time record for most men's Grand Slam singles titles with 24 major trophies. Famous for his unmatched return of serve, endurance, and elastic movement, he has spent more total weeks at World No. 1 than any tennis player in history."
  },
  {
    tip: "Court dominated women's tennis across the 1960s and 70s, winning 11 Australian, 5 French, 5 US, and 3 Wimbledon singles titles.",
    explanation: "Margaret Court achieved a record 24 Grand Slam singles titles between 1960 and 1973. In 1970, she became the first woman in the Open Era to complete a calendar-year Grand Slam by sweeping all four major tournaments in a single season."
  },
  {
    tip: "Thorpe's massive size 17 feet acted like natural flippers in the pool, powering his distinctive six-beat kick and black full-body swimsuit.",
    explanation: "Nicknamed 'The Thorpedo', Ian Thorpe won five Olympic gold medals across Sydney 2000 and Athens 2004. He established 13 individual long-course world records and was named Swimming World Swimmer of the Year four times."
  },
  {
    tip: "Fraser became a national hero by winning 100m freestyle gold at Melbourne 1956, Rome 1960, and Tokyo 1964, despite later controversy over a flag heist in Tokyo.",
    explanation: "Dawn Fraser was the first swimmer to win the same Olympic event at three consecutive Olympic Games. Over her illustrious decade-long international career, she set 39 world records and became the first woman to break the one-minute barrier for the 100-metre freestyle."
  },
  {
    tip: "T-shirts at the 1972 Munich Games declared 'All that glitters is not Gould' as the 15-year-old phenom swept five individual swimming medals.",
    explanation: "Shane Gould set world records in all five freestyle distances (100m, 200m, 400m, 800m, 1500m) simultaneously. At the 1972 Munich Olympics, she won 3 gold, 1 silver, and 1 bronze medal at just 15 years old before retiring from competitive swimming at age 16."
  },
  {
    tip: "After lighting the Olympic flame, Freeman ran 49.11 seconds wearing a custom hooded green-and-yellow bodysuit, taking her victory lap with both flags.",
    explanation: "Cathy Freeman's 400-metre victory at the Sydney 2000 Olympics remains one of Australia's most defining sporting moments. Bearing the emotional weight of a nation, she became the first Indigenous Australian to win an individual Olympic gold medal."
  },
  {
    tip: "Nicknamed Australia's 'Golden Girl', Cuthbert won 100m, 200m, and 4x100m gold at Melbourne 1956, then added the inaugural 400m gold at Tokyo 1964.",
    explanation: "Betty Cuthbert remains the only track athlete in Olympic history to win gold medals in the 100m, 200m, and 400m sprints. Her high-knee, wide-mouthed running style thrilled home crowds at the 1956 Melbourne Olympics."
  },
  {
    tip: "Pearson overcame heavy downpours at London 2012 to win gold in an Olympic record time of 12.35 seconds, upgrading her 2008 Beijing silver medal.",
    explanation: "Sally Pearson was the dominant female 100-metre hurdler of her era, taking gold at the 2012 London Olympics and winning World Championship titles in 2011 and 2017. Her flawless hurdle technique earned her IAAF World Female Athlete of the Year honors."
  },
  {
    tip: "Rice set world records in all three of her victories at the Water Cube in Beijing: the 200m IM, 400m IM, and 4x200m freestyle relay.",
    explanation: "Coached by Michael Bohl, Stephanie Rice produced a stellar performance at the 2008 Beijing Olympics. Winning three gold medals with three world-record times, she dominated the individual medley events with extraordinary stroke transition technique."
  },

  // 20 - 29
  {
    tip: "Despite breaking 17 distance running world records, Olympic gold eluded Clarke; he tragically collapsed from severe altitude sickness at Mexico City 1968.",
    explanation: "Ron Clarke systematically rewrote distance running record books throughout the 1960s. So revered was Clarke's legacy that Czech legend Emil Zátopek personally gifted Clarke one of his own Olympic gold medals in profound admiration."
  },
  {
    tip: "Trained by Percy Cerutty among Portsea's sand dunes, Elliott went completely undefeated in the 1500m and mile throughout his senior competitive career.",
    explanation: "Herb Elliott is universally recognized among history's greatest middle-distance runners. At the 1960 Rome Olympics, he smashed his own world record in the 1500 metres by over half a second, destroying the field by 20 metres."
  },
  {
    tip: "During the 1956 Mile Championship, Landy accidentally spiked Clarke, stopped to help him up, lost 30 yards, then sprinted back to win the race anyway.",
    explanation: "John Landy's gesture at the 1956 Australian National Championships is celebrated as one of the ultimate acts of sportsmanship in history. A bronze statue depicting Landy assisting Clarke stands outside Melbourne's Olympic Park."
  },
  {
    tip: "Nicknamed 'The Great White Shark' for his aggressive play and blond hair, Norman spent 331 weeks atop the World Official Golf Rankings.",
    explanation: "Greg Norman dominated global golf throughout the 1980s and 1990s, winning 89 professional events worldwide, including two Open Championships (1986, 1993). He was the first player in PGA Tour history to exceed $10 million in career earnings."
  },
  {
    tip: "Scott ended an 77-year Aussie dry spell at Augusta National in 2013, shouting 'C'mon Aussie!' after sinking a crucial birdie on 18 before beating Angel Cabrera in a playoff.",
    explanation: "On a rainy Sunday at Augusta National, Adam Scott became the first Australian to don the iconic Green Jacket. After matching Cabrera at 9-under, Scott sank a 12-foot birdie putt on the second playoff hole (hole 10) to secure his landmark Major title."
  },
  {
    tip: "Thomson mastered links golf to win three consecutive Claret Jugs (1954–1956) and added victories in 1958 and 1965 across Scotland and England.",
    explanation: "Peter Thomson was a legend of British links play, winning the Open Championship five times between 1954 and 1965. Renowned for his effortless rhythmic swing and sharp tactical mind, he was inducted into the World Golf Hall of Fame in 1988."
  },
  {
    tip: "Legend holds Archer walked over 800 km from Nowra to Melbourne to compete; he won the first two Melbourne Cups carrying heavy impost weights.",
    explanation: "Trained by Etienne de Mestre, Archer won the inaugural Melbourne Cup in 1861 by six lengths and successfully defended his title in 1862 carrying 10 stone 2 pounds. He missed the 1863 cup due to a telegraphic administrative error."
  },
  {
    tip: "Standing 17.1 hands high with a massive 6.35 kg heart, 'Big Red' won 37 of 51 starts before his mysterious, tragic death in Menlo Park, California in 1932.",
    explanation: "Phar Lap was Australia's beloved Depression-era racehorse. Despite surviving a shooting attempt by bookmakers days earlier, Phar Lap carried 9 stone 12 pounds to a dominant victory in the 1930 Melbourne Cup."
  },
  {
    tip: "Owner Tony Santic named the mare using the initials of six female employees: Maureen, Tony, Kylie, Belinda, Diana, and Valerie.",
    explanation: "Makybe Diva made Australian horse racing history as the only thoroughbred to win three consecutive Melbourne Cups (2003, 2004, 2005). Race caller Greg Miles immortalized her third win with the iconic call: 'A champion becomes a legend!'"
  },
  {
    tip: "Coached by Peter Moody and ridden by Luke Nolen, the sprinting mare retired with an unblemished 25-0 record, including 15 Group 1 titles.",
    explanation: "Black Caviar was an unbeaten Australian sprinting phenomenon. Rated the world's top sprinter for four straight years (2010-2013), her victories drew massive crowds across Australia and included a dramatic win in the Diamond Jubilee Stakes at Royal Ascot."
  },

  // 30 - 39
  {
    tip: "Winx possessed an uncanny stride frequency and lightning acceleration, stringing together 33 straight wins and 25 Group 1 titles before retiring.",
    explanation: "Trained by Chris Waller and ridden by Hugh Bowman, Winx became the highest-earning thoroughbred in Australian racing history ($26.4 million). Her streak spanned four years and featured four historic Cox Plate victories."
  },
  {
    tip: "Moonee Valley's tight cambered turns became Winx's fortress as she won four straight weight-for-age titles at the venue between 2015 and 2018.",
    explanation: "Winx broke Kingston Town's long-standing record by winning four consecutive Cox Plates. Her dominant performances against elite international fields established her among the greatest turf racehorses of all time."
  },
  {
    tip: "Race caller Bill Collins famously announced 'Kingston Town can't win!' entering the home turn in 1982 before the black gelding flew home to complete his hat-trick.",
    explanation: "Trained by Tommy Smith and ridden by Malcolm Johnston, Kingston Town dominated weight-for-age racing, becoming the first horse to win three consecutive Cox Plates (1980, 1981, 1982)."
  },
  {
    tip: "After Australia's first Test win in England in 1882, The Sporting Times printed a notice stating English cricket had died and 'the body will be cremated and the ashes taken to Australia.'",
    explanation: "Following England's defeat at The Oval, captain Ivo Bligh pledged to recover 'the ashes' during the 1882–83 tour. Victorian women presented Bligh with a tiny terracotta urn containing the ashes of a burnt bail, sparking cricket's most famous bilateral rivalry."
  },
  {
    tip: "Warne's first ball in an Ashes Test pitched outside leg stump, gripped, spun sharply across the pitch, and took off-stump, leaving Mike Gatting bewildered.",
    explanation: "Delivered at Old Trafford on June 4, 1993, Shane Warne's 'Ball of the Century' ignited a leg-spin revival worldwide. Warne went on to claim 708 Test wickets and capture 195 Ashes wickets across his extraordinary career."
  },
  {
    tip: "Warne hit the 700-wicket milestone on Boxing Day 2006 at the MCG by clean bowling Andrew Strauss, igniting wild celebrations before 89,000 home fans.",
    explanation: "Shane Warne became the first bowler in history to reach 700 Test wickets. Master of the flipper, slider, and leg-break, Warne was selected as one of five Wisden Cricketers of the 20th Century."
  },
  {
    tip: "McGrath's metronomic accuracy on off-stump earned him the nickname 'Pigeon'; he took 563 wickets at an average of 21.64 across 124 Tests.",
    explanation: "Glenn McGrath holds the record for most Test wickets by an Australian fast bowler. Renowned for his seamless seam movement, relentless length, and pinpoint target bowling, he anchored Australia's dominant era from 1993 to 2007."
  },
  {
    tip: "Bradman scored 309 of his 334 runs in a single day of play at Leeds on July 11, 1930, reaching his triple century before the close of play.",
    explanation: "Sir Donald Bradman's 334 against England at Headingley in 1930 was an astonishing display of run-scoring. He scored 100 before lunch, 100 between lunch and tea, and another 100 before stumps, setting a record for the highest individual Ashes score by an Australian."
  },
  {
    tip: "Hayden smashed 38 fours and 11 sixes against Zimbabwe at the WACA ground in Perth in October 2003, topping Brian Lara's 375.",
    explanation: "Matthew Hayden set a then-world record Test score of 380 against Zimbabwe at Perth in 2003. Brian Lara reclaimed the record six months later with 400 not out against England."
  },
  {
    tip: "Taylor declared overnight on 334 not out against Pakistan at Peshawar in October 1998 out of reverence for Sir Donald Bradman's legendary benchmark.",
    explanation: "Mark Taylor batted for over 12 hours in Peshawar to reach 334 not out. Rather than attempting to surpass Bradman's Australian record score, Taylor unselfishly declared the innings closed at stumps on Day 2."
  },

  // 40 - 49
  {
    tip: "Steve Waugh's aggressive mental toughness was coined 'Steve Waugh's Invincibles', driving Australia to 16 straight Test victories from 1999 to 2001.",
    explanation: "Captained by Steve Waugh, the Australian Test team won 16 consecutive Test matches between October 1999 and February 2001. The winning streak included series sweeps over Zimbabwe, Pakistan, India, the West Indies, and Sir Lanka."
  },
  {
    tip: "Ponting matched Waugh's record by leading Australia to another 16 consecutive Test victories between December 2005 and January 2008.",
    explanation: "Under Ricky Ponting's captaincy, Australia mounted a second historic 16-match Test winning streak. The run included a 5-0 Ashes whitewash over England in 2006-07 and home series sweeps against South Africa, West Indies, and Sri Lanka."
  },
  {
    tip: "Wayne Bennett led the Broncos to win the inaugural 1998 NRL title in the newly merged competition following the Super League War.",
    explanation: "The Brisbane Broncos won the inaugural National Rugby League (NRL) premiership in 1998, defeating the Canterbury Bulldogs 38-12 at Sydney Football Stadium. Gorden Tallis won the Clive Churchill Medal as best on ground."
  },
  {
    tip: "Trailing 14-0 at halftime against St George Illawarra, Melbourne won 20-18 when referee Bill Harrigan awarded a late penalty try after Craig Smith was tackled high in the in-goal.",
    explanation: "In just their second season in the competition, the Melbourne Storm captured the 1999 NRL Premiership. Trailing at halftime before a crowd of 107,999 at Stadium Australia, Melbourne completed a legendary comeback capped by the late penalty try."
  },
  {
    tip: "St George's legendary 11-straight premiership run (1956–1966) remains an unbeatable world record for consecutive top-flight rugby league titles.",
    explanation: "The St. George Dragons dominated Australian rugby league for over a decade, winning 11 straight Sydney premierships from 1956 to 1966. Featuring hall-of-famers Norm Provan, Reg Gasnier, Johnny Raper, and Eddie Lumsden, they were known as the 'Never Before, Never Again' team."
  },
  {
    tip: "The Rabbitohs' proud history includes 21 premierships, dating back to the inaugural 1908 NSWRFL season through to their emotional 2014 title win.",
    explanation: "South Sydney Rabbitohs hold the record for the most first-grade rugby league premierships in Australian history (21 titles). Known as 'The Pride of the League', their victory over Canterbury in 2014 ended a 43-year premiership drought."
  },
  {
    tip: "Named after Charles Brownlow, the long-serving Geelong administrator, the award uses umpire votes cast 3-2-1 after every home-and-away game.",
    explanation: "The Charles Brownlow Trophy (Brownlow Medal) has been awarded since 1924 to the fairest and best player in the VFL/AFL during the home-and-away season. Players who incur a tribunal suspension during the season are ineligible to win."
  },
  {
    tip: "Named in honor of Melbourne's hall-of-fame coach Norm Smith, a five-member media panel votes on the Grand Final's best player on ground.",
    explanation: "First awarded in the 1979 VFL Grand Final to Carlton's Wayne Harmes, the Norm Smith Medal recognizes outstanding performance on Australian rules football's biggest stage. Notable multi-time winners include Dustin Martin (3), Gary Ayres (2), and Luke Hodge (2)."
  },
  {
    tip: "John Coleman kicked an astonishing 537 goals in just 98 games for Essendon before a knee injury ended his career at age 25.",
    explanation: "The Coleman Medal is awarded annually to the AFL player who kicks the most goals during the home-and-away season. It was named in 1981 in tribute to legendary Essendon full-forward John Coleman."
  },
  {
    tip: "Named after Herbert Henry 'Dally' Messenger, the rugby league pioneer who defected from rugby union in 1907 to launch the professional game in Australia.",
    explanation: "The Dally M Medal is rugby league's highest individual honor, awarded annually to the best and fairest player in the NRL season. Independent commentators award 3-2-1 votes after each regular season match."
  },

  // 50 - 59
  {
    tip: "Named after Clive Churchill, the South Sydney 'Little Master' who is revered as one of rugby league's greatest fullbacks and immortals.",
    explanation: "The Clive Churchill Medal has been presented since the 1986 NSWRFL Grand Final to the player evaluated as best on ground in the premiership decider by Australian national team selectors."
  },
  {
    tip: "Named in honor of 'The King' Wally Lewis, Queensland's legendary captain who won an unprecedented eight Man of the Match awards in Origin history.",
    explanation: "The Wally Lewis Medal is presented annually to the player of the series in rugby league's State of Origin contest between New South Wales and Queensland, as chosen by a panel of former Origin legends."
  },
  {
    tip: "Queensland established a legendary era between 2006 and 2017, winning 11 out of 12 Origin series under coaches Mal Meninga and Kevin Walters.",
    explanation: "Representing the Maroons, Queensland leads New South Wales in total State of Origin series victories since the annual three-game concept was inaugurated. Built on interstate pride, the series is hailed as Australian sport's greatest rivalry."
  },
  {
    tip: "Arthur Beetson famously captained Queensland in the standalone 1980 match at Lang Park, punching Parramatta teammate Mick Cronin to establish Origin fire.",
    explanation: "On July 8, 1980, the inaugural State of Origin match took place at Brisbane's Lang Park. Prior to 1980, players represented the state where their club was located; Origin revolutionized the sport by selecting players based on state of origin birth/first club."
  },
  {
    tip: "Bradbury was trailing far behind in last place when all four leaders collided and wiped out on the final turn, allowing him to glide across the line for gold.",
    explanation: "Steven Bradbury won Australia's first-ever Winter Olympic gold medal in the 1000m short track speed skating at Salt Lake City 2002. His improbable victory inspired the popular Australian colloquial phrase 'doing a Bradbury', meaning to win unexpectedly through luck or opponent error."
  },
  {
    tip: "Camplin trained on homemade water ramps in Melbourne and won gold in Salt Lake City just months after breaking both ankles in training.",
    explanation: "Alisa Camplin won gold in women's aerial skiing at the 2002 Salt Lake City Winter Olympics, becoming Australia's first female Winter Olympic champion. She backed up her gold with a bronze medal at the 2006 Torino Games."
  },
  {
    tip: "Bright performed her trademark 'Switch Backside 720' in Vancouver to score 45.0 points, taking gold after stomping her final run under immense pressure.",
    explanation: "Torah Bright won gold in the women's snowboard halfpipe at the 2010 Vancouver Winter Olympics and added silver at Sochi 2014. She remains one of Australia's most successful snow sport athletes in history."
  },
  {
    tip: "Steggall won bronze in the slalom at Nagano 1998, laying the groundwork for Australia's future snow sports programs before serving in federal parliament.",
    explanation: "Zali Steggall broke new ground for Australian winter sport by winning bronze in the women's slalom at the 1998 Nagano Winter Olympics. A year later, she won the 1999 World Championship slalom title in Vail, Colorado."
  },
  {
    tip: "Evans attacked on the Stage 20 individual time trial around Grenoble to overturn Andy Schleck's lead and ride into Paris wearing the maillot jaune.",
    explanation: "Cadel Evans became the first Australian to win the Tour de France in 2011. A former world champion mountain biker, Evans rode for BMC Racing Team and completed the 3,430 km race in 86 hours, 12 minutes, and 22 seconds."
  },
  {
    tip: "Brabham remains the only driver in Formula One history to win a World Championship driving a car of his own manufacture (the Brabham BT19 in 1966).",
    explanation: "Sir Jack Brabham was a three-time Formula One World Champion (1959, 1960, 1966). An engineer as well as a driver, the Australian icon co-founded the Brabham racing team with Ron Tauranac, winning four drivers' and two constructors' world titles."
  },

  // 60 - 69
  {
    tip: "Jones won five races in 1980 driving the Frank Williams-designed FW07B, securing Williams' first-ever Drivers' World Championship.",
    explanation: "Alan Jones became Australia's second Formula One World Champion in 1980. Aggressive and fiercely competitive, Jones scored 67 points in 1980, clinching the title at the penultimate race at Montreal."
  },
  {
    tip: "Brock dominated Mount Panorama in a succession of Toranas and Commodores, taking nine Bathurst 1000 wins between 1972 and 1987 in his famous #05 car.",
    explanation: "Peter Brock earned the title 'King of the Mountain' for his unparalleled record at Mount Panorama, Bathurst. Driving for the Holden Dealer Team, his most famous victory came in 1979 when he won by six laps and broke the lap record on the final lap."
  },
  {
    tip: "Lowndes debuted at Bathurst in 1994, went on to win seven Great Races, and scored 107 career Supercar race victories before retiring full-time.",
    explanation: "Craig Lowndes was the charismatic face of Australian V8 Supercars racing for over two decades. Mentored by Peter Brock, Lowndes won three Australian Touring Car Championships (1996, 1998, 1999) and seven Bathurst 1000 titles."
  },
  {
    tip: "Doubell trained under Franz Stampfl and equaled Peter Snell's world record time of 1:44.40 at high altitude in Mexico City to take gold.",
    explanation: "Ralph Doubell won gold in the 800 metres at the 1968 Mexico City Olympic Games. Running a perfectly timed race from off the pace, his Australian national record of 1:44.40 stood for over 40 years."
  },
  {
    tip: "Chilla Porter won silver behind Charles Dumas in Melbourne 1956 after an epic high jump battle lasting over five hours in front of 85,000 fans.",
    explanation: "Charles 'Chilla' Porter captured a famous high jump silver medal for Australia at the 1956 Melbourne Olympics. Clearing 2.10 metres, his performance stood as one of the highlights of Australia's track and field campaign."
  },
  {
    tip: "Hooker survived nerve-wracking third-attempt clearances in qualifying and the final before clearing 5.96 metres to set the Olympic record in Beijing.",
    explanation: "Steve Hooker won pole vault gold at the 2008 Beijing Olympics, becoming Australia's first male track and field Olympic champion since Ralph Doubell in 1968. He followed his Olympic gold by winning the World Championship title in Berlin in 2009."
  },
  {
    tip: "Lapierre won the 2010 World Indoor Long Jump title and captured gold at the 2010 Commonwealth Games in Delhi with an 8.30m leap.",
    explanation: "Fabrice Lapierre established himself as one of Australia's premier long jumpers, winning silver at the 2015 World Championships in Beijing and gold at the 2010 World Indoor Championships in Doha."
  },
  {
    tip: "Tallent crossed the line second in Beijing but was awarded the gold medal years later after Russian winner Alexey Denisov was disqualified for doping.",
    explanation: "Jared Tallent is one of Australia's most decorated track and field Olympians, winning gold (2008 50km walk), silver (2012, 2016 50km walk), and bronze (2008 20km walk) across three consecutive Olympic Games."
  },
  {
    tip: "Chalmers was just 18 years old when he stormed from seventh place at the 50m turn to touch first in 47.58 seconds at Rio 2016.",
    explanation: "Kyle Chalmers won gold in the 100-metre freestyle at the 2016 Rio Olympics. Known for his devastating back-half speed and late surge, Chalmers backed up his Rio gold with silver medals at Tokyo 2020 and Paris 2024."
  },
  {
    tip: "Horton famously called out Sun Yang's doping record before the race, then backed up his words by winning gold in 3:41.55.",
    explanation: "Mack Horton won gold in the 400-metre freestyle at the 2016 Rio Olympics, edging out Sun Yang by 0.13 seconds. His principled stance against doping in sport drew international headlines and admiration."
  },

  // 70 - 79
  {
    tip: "Titmus defeated American legend Katie Ledecky in thrilling head-to-head battles over 200m and 400m freestyle in Tokyo, earning coach Dean Boxall viral fame.",
    explanation: "Ariarne Titmus claimed double gold in the 200m and 400m freestyle at the 2020 Tokyo Olympics. Dubbed 'The Terminator', she defended her 400m freestyle Olympic title at Paris 2024."
  },
  {
    tip: "McKeon won 4 gold and 3 bronze medals in Tokyo, taking her career total to 14 Olympic medals—the most by any Australian athlete in history.",
    explanation: "Emma McKeon dominated the pool at the Tokyo 2020 Olympics, winning individual gold in the 50m and 100m freestyle alongside relay triumphs. Her 7 medals in Tokyo tied the all-time record for most medals won by a female athlete at a single Olympic Games."
  },
  {
    tip: "McKeown swept the 100m and 200m backstroke double at Tokyo 2020, dedicating her emotional victories to her late father, Sholto.",
    explanation: "Kaylee McKeown proved herself the undisputed world queen of backstroke at Tokyo 2020, winning gold in both the 100m and 200m backstroke plus the 4x100m medley relay. She successfully defended both backstroke titles at Paris 2024."
  },
  {
    tip: "Dubbed 'The Oarsome Foursome', the crew won gold in Barcelona 1992 and Atlanta 1996, becoming household icons through their popular TV appearances.",
    explanation: "The Oarsome Foursome (James Tomkins, Drew Ginn, Nick Green, Mike McKay) dominated world rowing in the coxless four. Their back-to-back Olympic victories in 1992 and 1996 cemented their place in Australian sporting folklore."
  },
  {
    tip: "Drew Ginn overcame a severe back injury that kept him out of Sydney 2000 to win his second Olympic gold alongside partner Duncan Free in Beijing.",
    explanation: "Drew Ginn and Duncan Free won gold in the men's coxless pair at the 2008 Beijing Olympics. Ginn won three Olympic gold medals across three different Olympic Games (1996, 2004, 2008)."
  },
  {
    tip: "Crawshay and Brennan executed a perfectly timed finish in the final 500m at Shunyi Rowing Park to beat Estonia and Great Britain.",
    explanation: "David Crawshay and Scott Brennan won gold in the men's double sculls at the 2008 Beijing Olympics. Both Tasmanian-connected rowers dominated their heats and finals to secure Australia's first double sculls Olympic gold."
  },
  {
    tip: "Slingsby won gold at London 2012; Burton pulled off a tactical masterclass in the medal race at Rio 2016 to keep Australia atop Laser sailing.",
    explanation: "Tom Slingsby (London 2012) and Tom Burton (Rio 2016) won consecutive Olympic gold medals for Australia in the Laser class dinghy. Both sailors navigated intense pressure in final medal races to maintain Australia's sailing dominance."
  },
  {
    tip: "Belcher won 470 gold with Malcolm Page at London 2012 and partnered Will Ryan to win gold at Tokyo 2020, retiring as Australia's most decorated Olympic sailor.",
    explanation: "Mathew Belcher won two Olympic gold medals and one silver medal in the men's 470 dinghy class across three Olympic Games. He also won eight 470 World Championship titles."
  },
  {
    tip: "Martin transformed his backyard into a full-scale BMX training park during COVID lockdowns before scoring 93.30 to win the inaugural Olympic gold.",
    explanation: "Logan Martin became the inaugural Olympic champion in men's BMX freestyle park at the Tokyo 2020 Games. A two-time World Champion, his tricks and execution set the international benchmark for the sport."
  },
  {
    tip: "Palmer scored an incredible 94.04 on his first run in the final, landing a 540 and kickflip body varial to secure gold at just 18 years of age.",
    explanation: "Keegan Palmer won gold in the inaugural men's skateboard park event at the Tokyo 2020 Olympics. Raised on Gold Coast skateparks, Palmer went on to defend his Olympic park title with gold at Paris 2024."
  },

  // 80 - 89
  {
    tip: "Fox completed her Olympic dream by winning C1 gold in Tokyo, then went on to accomplish a historic C1 and K1 slalom double at Paris 2024.",
    explanation: "Jessica Fox is universally hailed as the greatest canoe slalom paddle athlete of all time. Daughter of Olympic paddlers Richard Fox and Myriam Fox-Jerusalmi, she has accumulated 6 Olympic medals (3 gold) and over 14 World Championship gold medals."
  },
  {
    tip: "Robinson held off world record holder Greg Barton in a thrilling photo-finish sprint to take gold at the 1992 Barcelona Olympics.",
    explanation: "Clint Robinson won gold in the K1 1000 metres flatwater kayaking event at Barcelona 1992, becoming Australia's first-ever Olympic canoeing champion. He competed in five consecutive Olympic Games from 1992 to 2008."
  },
  {
    tip: "Wallace produced a explosive finish in the K1 500m at Beijing 2008 to win gold, adding a bronze in the K1 1000m at the same Games.",
    explanation: "Ken Wallace won gold in the men's K1 500m kayaking event at the 2008 Beijing Olympics. Raised on the Gold Coast, Wallace's sprint finish over the final 100 metres earned him Australia's second individual kayaking Olympic gold."
  },
  {
    tip: "Green and van der Westhuyzen clocked 3:15.28 to hold off Germany and Slovakia in a thrilling sprint finish at the Sea Forest Waterway.",
    explanation: "Thomas Green and Jean van der Westhuyzen won gold in the men's K2 1000m kayaking at the Tokyo 2020 Olympics. The duo paced their race perfectly to secure Australia's first Olympic gold in the K2 1000m event."
  },
  {
    tip: "Yvette Higgins scored a thunderous game-winning goal with 1.3 seconds remaining on the clock to beat the USA 4-3 in the gold medal match.",
    explanation: "The Australian women's national water polo team (The Aussie Stingers) won gold at the 2000 Sydney Olympics—the first time women's water polo was included on the Olympic program. Their dramatic last-second victory captivated home crowds."
  },
  {
    tip: "Led by superstars Lauren Jackson and Penny Taylor, the team won gold at the 2006 FIBA World Cup and five Olympic medals (3 silver, 2 bronze).",
    explanation: "The Australian women's national basketball team (The Opals) is one of Australia's most consistently successful international sporting teams, qualifying for every Olympic Games since 1984 and winning medals across five consecutive Olympics."
  },
  {
    tip: "The netball powerhouse has won 12 of 16 World Netball Championship tournaments since the event was introduced in 1963.",
    explanation: "The Australian national netball team (The Diamonds) is the premier force in world netball. Sporting a win rate exceeding 80% in international test matches, they hold 12 World Championship titles and 4 Commonwealth Games gold medals."
  },
  {
    tip: "Featuring global superstar Sam Kerr, the team captured Australia's imagination during their historic run on home soil in winter 2023.",
    explanation: "The Australian women's national football team (The Matildas) achieved their best FIFA Women's World Cup result by reaching the semi-finals in 2023. Their round-of-16 and quarter-final victories set nationwide television viewership records."
  },
  {
    tip: "Guided by Guus Hiddink in 2006 and Graham Arnold in 2022, the squad broke through the group stage at major tournaments in Germany and Qatar.",
    explanation: "The Australian men's national football team (The Socceroos) qualified for six FIFA World Cup finals tournaments (1974, 2006, 2010, 2014, 2018, 2022). Their 2022 campaign in Qatar featured group stage victories over Tunisia and Denmark."
  },
  {
    tip: "Patty Mills scored 42 points in the bronze medal game against Slovenia to secure Australia's first-ever Olympic men's basketball medal in Tokyo.",
    explanation: "The Australian men's national basketball team (The Boomers) broke a 64-year Olympic medal drought by winning bronze at the Tokyo 2020 Games. Led by Patty Mills and Joe Ingles, they defeated Slovenia 107-93."
  },

  // 90 - 99
  {
    tip: "Nicknamed 'The Wallabies' after the agile native marsupial, they lifted the Webb Ellis Cup in 1991 (England) and 1999 (Wales).",
    explanation: "The Australian national rugby union team won two Rugby World Cup championships. Captained by Nick Farr-Jones in 1991 and John Eales in 1999, the Wallabies established themselves among world rugby's elite powers."
  },
  {
    tip: "Represented by green-and-gold jerseys with the famous chevron, they have won 12 of the 16 Rugby League World Cup tournaments played since 1954.",
    explanation: "The Australian national rugby league team (The Kangaroos) has dominated international rugby league for decades. They have held the Rugby League World Cup continuously since 2013 under captains Cameron Smith and James Tedesco."
  },
  {
    tip: "Coached by Barry Dancer, Jamie Dwyer scored an iconic extra-time penalty corner goal against the Netherlands to seal Australia's first men's hockey gold.",
    explanation: "The Australian men's national field hockey team (The Kookaburras) won Olympic gold at Athens 2004 after numerous silver and bronze finishes. They are one of Australia's most successful sporting teams, with three World Cup titles and seven Commonwealth Games gold medals."
  },
  {
    tip: "Coached by Ric Charlesworth and starring Nova Peris and Rechelle Hawkes, they went undefeated across two entire Olympic tournaments.",
    explanation: "The Australian women's national field hockey team (The Hockeyroos) won three Olympic gold medals (Seoul 1988, Atlanta 1996, Sydney 2000). Under Ric Charlesworth's coaching in the 1990s, they maintained an unparalleled winning record in women's sport."
  },
  {
    tip: "Nicknamed 'Punter' for his love of greyhound and horse racing betting, Ponting scored 13,378 Test runs with 41 centuries across 168 Test matches.",
    explanation: "Ricky Ponting is Australia's all-time leading run-scorer in Test and One Day International cricket. A brutal puller of the ball, Ponting captained Australia during an era of unprecedented success, winning two World Cups as captain (2003, 2007)."
  },
  {
    tip: "Nicknamed 'Captain Grumpy', Border took over the captaincy during a dark era in 1984 and rebuilt Australian cricket into world champions by 1987.",
    explanation: "Allan Border was the first player in world cricket history to pass 11,000 Test runs, finishing with 11,174 runs across 156 Tests. He held the world record for most consecutive Test matches played (153)."
  },
  {
    tip: "Gilchrist smashed the fastest Ashes century in history off 57 balls at Perth in 2006, walked when he knew he was out, and revolutionized the wicketkeeper-batsman role.",
    explanation: "Adam Gilchrist was a revolutionary force in international cricket. Playing 96 Tests for Australia, he scored 5,570 runs at an astonishing strike rate of 81.95, while taking 379 catches and 37 stumpings behind the wickets."
  },
  {
    tip: "Healy's sharp glovework and fierce combativeness yielded 395 Test dismissals (366 catches, 29 stumpings) across 119 Test matches.",
    explanation: "Ian Healy was Australia's premier wicketkeeper throughout the 1990s. Recognized for his spotless footwork against spin legend Shane Warne, Healy was named in Cricket Australia's Team of the 20th Century."
  },
  {
    tip: "Scorecards of the 1970s and 80s were dominated by the phrase 'c Marsh b Lillee', which occurred 95 times in Test cricket history.",
    explanation: "Rod Marsh was Australia's pugnacious wicketkeeper across 96 Test matches between 1970 and 1984. He was the first Australian wicketkeeper to score a Test century (against Pakistan in 1972)."
  },
  {
    tip: "Lillee was famed for his galloping run-up, classic fast bowler's headband, fierce competitive aura, and landmark aluminum bat incident at Perth in 1979.",
    explanation: "Dennis Lillee was widely regarded as the complete fast bowler. Taking 355 Test wickets in 70 Tests at an average of 23.92, he held the world record for most Test wickets upon his retirement in 1984."
  },

  // 100 - 107
  {
    tip: "Thomson was clocked at 160.4 km/h (99.7 mph) in 1975 using high-speed cameras, forming a terrifying fast bowling duo with Dennis Lillee.",
    explanation: "Jeff Thomson was renowned for his unorthodox slinging action that generated frightening pace and unpredictable bounce. His fast bowling partnership with Dennis Lillee sparked the famous chant: 'Thommo to the left of them, Lillee to the right'."
  },
  {
    tip: "Johnson destroyed England with raw 150 km/h pace and steep bounce, winning the 2014 Allan Border Medal and Sir Garfield Sobers Trophy.",
    explanation: "Mitchell Johnson took 313 Test wickets for Australia. His left-arm fast bowling tore through England during the 2013-14 Ashes, taking 37 wickets at an average of 13.97 in one of cricket history's most dominant individual series."
  },
  {
    tip: "Johnson's iconic handlebar mustache and express pace produced 37 wickets across five Tests as Australia swept England 5-0 in 2013-14.",
    explanation: "Mitchell Johnson's performance in the 2013-14 Ashes was a masterclass in fast bowling. Bowling at speeds exceeding 150 km/h, he produced nine 5-wicket innings hauls to completely dislodge the English batting order."
  },
  {
    tip: "Starc's lethal left-arm inswinging yorkers delivered 27 wickets in 10 matches during the 2019 tournament in England, breaking Glenn McGrath's 2007 record.",
    explanation: "Mitchell Starc established himself as one of modern white-ball cricket's greatest tournament bowlers. He was named Player of the Tournament at the 2015 World Cup (22 wickets) and led the bowling tallies again at the 2019 World Cup (27 wickets)."
  },
  {
    tip: "Nicknamed 'Garry' (after former AFL player Garry Lyon) or 'GOAT', Lyon worked as an Adelaide Oval groundsman before his surprise Test debut in 2011.",
    explanation: "Nathan Lyon is Australia's most successful off-spin bowler in Test history, taking over 500 Test wickets. His overspin and bounce have made him an indispensable fixture in Australia's bowling attack for over a decade."
  },
  {
    tip: "MacGill boasted a higher strike rate than Warne, taking 208 Test wickets in just 44 Tests with his big-spinning, classical leg-break.",
    explanation: "Stuart MacGill possessed one of the biggest leg-breaks in modern cricket history. Despite playing during the same era as Shane Warne, MacGill took 5-wicket hauls 12 times in Tests and stepped up brilliantly whenever Warne was unavailable."
  },
  {
    tip: "Ponting celebrated his 100th Test match at the SCG in January 2006 by scoring 120 and 143 not out against South Africa, leading Australia to victory.",
    explanation: "Ricky Ponting became the only batsman in Test history to score twin centuries in his 100th Test match. His second-innings 143 not out guided Australia to a thrilling 8-wicket victory on the final day."
  },
  {
    tip: "The left-hand/right-hand opening combination complemented Hayden's brute force with Langer's tenacious defense across 113 Test innings.",
    explanation: "Matthew Hayden and Justin Langer formed one of cricket history's most prolific opening partnerships. Together they compiled 5,655 runs at an average of 51.88, including 14 century opening partnerships between 1997 and 2007."
  }
];

if (updates.length !== sports.length) {
  console.error(`Error: updates length (${updates.length}) !== sports length (${sports.length})`);
  process.exit(1);
}

for (let i = 0; i < sports.length; i++) {
  sports[i].tip = updates[i].tip;
  sports[i].explanation = updates[i].explanation;
}

fs.writeFileSync(sportsPath, JSON.stringify(sports, null, 2), 'utf8');
console.log('Successfully updated sports.json with audited tips and explanations!');
