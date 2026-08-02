const fs = require('fs');

const popPath = 'C:/dev/gw-quiz-trainer/src/data/questions/popCultureNews.json';
const pop = JSON.parse(fs.readFileSync(popPath, 'utf8'));

const updates = [
  // 0 - 9
  {
    tip: "Formed by Santo Cilauro, Rob Sitch, Tom Gleisner, and Jane Kennedy, the company takes its name from their love of dogs and Aussie working-class spirit.",
    explanation: "Working Dog Productions created *Utopia*, the acclaimed ABC workplace comedy satirizing the bureaucratic bungling of the fictional Nation Building Authority. The team also produced classic shows like *Frontline*, *The Panel*, and *Have You Been Paying Attention?*."
  },
  {
    tip: "Director George Miller spent decades in development hell before filming in the Namib Desert, creating a high-octane masterpiece featuring Tom Hardy and Charlize Theron.",
    explanation: "*Mad Max: Fury Road* dominated the technical categories at the 88th Academy Awards, winning six Oscars for Film Editing, Sound Editing, Sound Mixing, Production Design, Makeup & Hairstyling, and Costume Design."
  },
  {
    tip: "Ledger hid away in a London hotel room for a month to develop the Joker's manic posture, chilling laugh, and lip-licking tic before his tragic passing in 2008.",
    explanation: "Heath Ledger received a posthumous Academy Award for Best Supporting Actor for his transformative portrayal of the Joker in Christopher Nolan's *The Dark Knight* (2008). His performance remains one of cinema's most revered comic book adaptations."
  },
  {
    tip: "Blanchett won Best Supporting Actress playing Katherine Hepburn in *The Aviator* (2004) and Best Actress playing Jeanette 'Jasmine' Francis in *Blue Jasmine* (2013).",
    explanation: "Cate Blanchett is the only Australian actor to win two acting Academy Awards. Renowned for her incredible range across stage and screen, she has also won four Golden Globes and four BAFTA Awards."
  },
  {
    tip: "Kidman wore a prosthetic nose to portray author Virginia Woolf, writing *Mrs Dalloway* while wrestling with severe mental illness in 1920s England.",
    explanation: "Nicole Kidman became the first Australian actress to win the Academy Award for Best Actress for her performance in Stephen Daldry's *The Hours* (2002), co-starring Meryl Streep and Julianne Moore."
  },
  {
    tip: "Crowe delivered the famous line 'Are you not entertained?' while portraying a deposed Roman general turned gladiator in Ridley Scott's historical epic.",
    explanation: "Russell Crowe won the Best Actor Oscar in 2001 for his portrayal of Maximus Decimus Meridius in *Gladiator*. The film resurrected the swords-and-sandals genre and won five Academy Awards, including Best Picture."
  },
  {
    tip: "Rush mastered complex piano pieces to portray Australian savant David Helfgott, winning the Oscar, Golden Globe, and BAFTA in a single season.",
    explanation: "Geoffrey Rush won the Academy Award for Best Actor for Scott Hicks' biographical drama *Shine* (1996). Rush went on to achieve the 'Triple Crown of Acting' by securing an Oscar, Emmy, and Tony Award."
  },
  {
    tip: "The statuette was named after Graham Kennedy's *In Melbourne Tonight* co-host Norman 'Logie' Swain, who designed the original wooden carving.",
    explanation: "The Logie Awards have celebrated Australian television excellence since 1959. The premier honor, the Gold Logie, is voted by the public and presented to the most popular personality on Australian television."
  },
  {
    tip: "Look for the iconic pointy trophy—ARIA awards recognize commercial sales, radio airplay, and artistic achievements across Australian recording artists.",
    explanation: "The ARIA Music Awards have been presented annually by the Australian Recording Industry Association since 1987. The event honors achievements across pop, rock, country, Indigenous music, and hall-of-fame inductees."
  },
  {
    tip: "Established in 1921 by the trustees of Jules Francois Archibald, the prize specifies that entries must be 'preferentially of some man or woman distinguished in art, letters, science or politics'.",
    explanation: "The Archibald Prize is Australia's most famous portraiture award, presented at the Art Gallery of New South Wales. It routinely sparks lively national artistic debate and attracts thousands of gallery visitors annually."
  },

  // 10 - 19
  {
    tip: "Named in honor of Richard Wynne, who bequeathed funds in 1895 for the encouragement of Australian landscape painting and figurative sculpture.",
    explanation: "The Wynne Prize is awarded annually alongside the Archibald Prize by the Art Gallery of New South Wales. It rewards the best landscape painting of Australian scenery or figurative sculpture created by Australian artists."
  },
  {
    tip: "Established under the will of Sir John Sulman, this prize specifically celebrates narrative, genre, or decorative subject painting.",
    explanation: "The Sir John Sulman Prize is presented annually at the Art Gallery of New South Wales for the best subject painting, genre painting, or mural project executed by an Australian artist."
  },
  {
    tip: "Formed by brothers Malcolm and Angus Young in Sydney in 1973, their name came from their sister Margaret seeing 'AC/DC' on her sewing machine electricity label.",
    explanation: "AC/DC's *Back in Black* (1980), recorded following the tragic death of lead singer Bon Scott with new vocalist Brian Johnson, became the second highest-selling album in music history (over 50 million copies worldwide)."
  },
  {
    tip: "Hutchence's smoldering stage presence and hit singles like *Need You Tonight* and *Never Tear Us Apart* propelled the Sydney sextet to international megastardom.",
    explanation: "INXS reached international stardom in the late 1980s with their smash album *Kick* (1987). Combining funk, rock, and new wave, they became one of Australia's highest-exporting music acts."
  },
  {
    tip: "Frontman Peter Garrett famously served as a Federal Cabinet Minister and President of the Australian Conservation Foundation between music stints.",
    explanation: "Midnight Oil combined fierce political activism, anti-war themes, and Indigenous land rights advocacy with soaring rock anthems. Their 1987 album *Diesel and Dust* gained worldwide critical acclaim."
  },
  {
    tip: "Barnes' raw, gravelly vocals anchored the Adelaide rock band through anthems capturing working-class Australian life, military memory, and heartbreak.",
    explanation: "Cold Chisel, featuring songwriter Don Walker and singer Jimmy Barnes, produced timeless Australian pub-rock classics including *Khe Sanh*, *Flame Trees*, *Cheap Wine*, and *Bow River* during their 1970s and 80s peak."
  },
  {
    tip: "Judith Durham's soaring soprano vocals pushed the Melbourne quartet to top the UK and US pop charts alongside The Beatles in 1965.",
    explanation: "The Seekers were the first Australian pop group to achieve major international chart success in the UK and USA. Hits like *Georgy Girl*, *I'll Never Find Another You*, and *The Carnival Is Over* sold over 50 million records."
  },
  {
    tip: "Composed by Harry Vanda and George Young (older brother of AC/DC's Malcolm and Angus), the track was praised by Paul McCartney as a pop masterwork.",
    explanation: "The Easybeats scored a historic global smash hit in 1966 with *Friday on My Mind*. Formed at the Villawood Migrant Hostel in Sydney, they paved the way for international recognition of Australian rock."
  },
  {
    tip: "Brothers Barry, Robin, and Maurice Gibb grew up in Redcliffe, Queensland, before returning to the UK to reign supreme over the late 1970s disco era.",
    explanation: "The Bee Gees composed and recorded soundtrack hits for *Saturday Night Fever* (1977), including *Stayin' Alive*, *Night Fever*, and *How Deep Is Your Love*, creating one of the best-selling albums of all time."
  },
  {
    tip: "Frontman Colin Hay added a distinctive flute riff played by Greg Ham (borrowed from the nursery rhyme *Kookaburra Sits in the Old Gum Tree*).",
    explanation: "Men at Work won the 1983 Grammy Award for Best New Artist. Their smash single *Down Under* simultaneously topped both the US and UK singles charts in early 1983 alongside their album *Business as Usual*."
  },

  // 20 - 29
  {
    tip: "Formed after the split of Split Enz, Neil Finn composed classic singalong melodies like *Don't Dream It's Over*, which reached No. 2 on the US Billboard chart.",
    explanation: "Crowded House produced timeless pop-rock melodies across the 80s and 90s. Their farewell concert on the steps of the Sydney Opera House in 1996 drew an estimated 100,000 emotional fans."
  },
  {
    tip: "Kylie launched her career on *Neighbours* as mechanic Charlene Robinson before becoming the Princess of Pop with record-breaking dance hits spanning five decades.",
    explanation: "Kylie Minogue is the highest-selling female Australian artist of all time. Her career hits range from 1987's *The Loco-Motion* to 2001's *Can't Get You Out of My Head* and 2023's Grammy-winning global sensation *Padam Padam*."
  },
  {
    tip: "Goodrem played aspiring singer Nina Tucker on *Neighbours* while releasing hit singles like *Born to Try*, *Lost Without You*, and *Innocent Eyes*.",
    explanation: "Delta Goodrem's debut album *Innocent Eyes* (2003) spent 29 non-consecutive weeks at No. 1 on the ARIA Albums Chart, producing five consecutive No. 1 singles and becoming one of Australia's highest-selling albums."
  },
  {
    tip: "Sia Furler began singing with Adelaide indie band Crisp and Zero 7 before songwriting global hits for Rihanna (*Diamonds*) and Beyoncé alongside her solo work.",
    explanation: "Sia achieved widespread global fame while concealing her face behind giant two-toned wigs. Her hits *Chandelier* and *Cheap Thrills* topped charts globally, amassing billions of streams."
  },
  {
    tip: "Tones and I (Toni Watson) was busking on the streets of Byron Bay when she wrote the synth-pop track that spent 24 weeks at No. 1 on the ARIA singles chart.",
    explanation: "Tones and I achieved international viral fame with *Dance Monkey* in 2019. The track topped charts in over 30 countries and became one of the most-streamed songs in Spotify history by a female artist."
  },
  {
    tip: "Vance Joy (James Keogh) was a former VFL footballer for Coburg before recording his ukelele-driven folk single *Riptide*.",
    explanation: "Vance Joy scored a record-breaking hit with *Riptide*, which won triple j's Hottest 100 of 2013 and spent a record 120 consecutive weeks in the ARIA Top 100 singles chart."
  },
  {
    tip: "Gotye (Wouter De Backer) crafted the song in a barn on his parents' Mornington Peninsula property, sampling Luiz Bonfá's 1960 guitar riff.",
    explanation: "Gotye's duetting masterpiece *Somebody That I Used to Know* (featuring Kimbra) topped charts in over 26 countries in 2011-12, winning three Grammy Awards including Record of the Year."
  },
  {
    tip: "Flume (Harley Streten) pioneered the 'future bass' electronic genre, winning the 2017 Best Dance/Electronic Album Grammy for his sophomore release.",
    explanation: "Flume led a global wave of Australian electronic producers in the 2010s. His album *Skin* featured collaborative hits like *Never Be Like You* (feat. Kai) and *Say It* (feat. Tove Lo)."
  },
  {
    tip: "Created by Reg Watson, the show launched the international careers of Kylie Minogue, Jason Donovan, Guy Pearce, Margot Robbie, and Jesse Spencer.",
    explanation: "*Neighbours* premiered on Seven Network before moving to Ten in 1986, becoming a colossal ratings hit in the UK. The 1987 wedding of Scott (Jason Donovan) and Charlene (Kylie Minogue) drew nearly 20 million British viewers."
  },
  {
    tip: "Set in the fictional NSW coastal town of Summer Bay (filmed at Sydney's Palm Beach), the soap centers on foster families and surf lifesavers.",
    explanation: "*Home and Away* has served as an actor training ground for major Hollywood stars including Heath Ledger, Chris Hemsworth, Naomi Watts, Isla Fisher, and Ryan Kwanten."
  },

  // 30 - 39
  {
    tip: "Meagher's character became famous for classic Aussie slang catchphrases like 'Strewth!', 'Stone the crows!', and 'Flamin' galah!'.",
    explanation: "Ray Meagher holds the Guinness World Record for the longest-serving actor in an Australian television soap opera, portraying storekeeper and former shire president Alf Stewart on *Home and Away* since its 1988 pilot."
  },
  {
    tip: "Centered around Matron Maggie Sloan, Dr. Terence Elliott, and beloved Wandin Valley locals like publican Frank Hogan and nurse Shirley Gilroy.",
    explanation: "*A Country Practice* aired 1,058 episodes on Seven, capturing rural Australian life, medical drama, and social issues. Its 1983 episode depicting Molly Jones' (Anne Tenney) battle with leukemia remains one of Australian TV's most watched moments."
  },
  {
    tip: "Set in a fictional Victorian country town police station, the series starred John Wood as Senior Sergeant Tom Croydon.",
    explanation: "*Blue Heelers* tied *Homicide* for the most Logie Awards won by a drama series. Over 12 seasons, the police procedural tackled rural crime and personal drama in Mount Thomas."
  },
  {
    tip: "Turner and Riley created Fountain Lakes mother and daughter duo Kath Day-Knight ('I'm high maintenance!') and Kim Craig ('Look at moi!').",
    explanation: "*Kath & Kim* premiered on the ABC in 2002, becoming a massive ratings phenomenon. Packed with suburban malapropisms, tracksuit fashion, and hornbag attitude, it spawned five series and telemovies."
  },
  {
    tip: "Flanagan portrays Helen Tudor-Fisk, a disgraced Sydney lawyer who relocates to Melbourne to work in a suburban probate law firm wearing a signature brown suit.",
    explanation: "*Fisk* won the Best Comedy Series at the prestigious Series Mania festival in France. Written by and starring Kitty Flanagan, the ABC comedy earned praise for its dry workplace humor."
  },
  {
    tip: "Formed in 1993 by former D-Generation members, their output satirizes Australian politics, corporate spin, and suburban absurdities.",
    explanation: "Working Dog Productions (Rob Sitch, Santo Cilauro, Tom Gleisner, Jane Kennedy) has crafted many of Australia's most enduring screen comedies, winning multiple Logies, AACTA Awards, and box-office records."
  },
  {
    tip: "Darryl Kerrigan (Michael Caton) famously defended his family's airport-adjacent home by appealing to 'the vibe of the constitution' with lawyer Dennis Denuto.",
    explanation: "Directed by Rob Sitch and filmed in just 11 days on a tiny budget, *The Castle* (1997) is a cherished Australian comedy classic that immortalized quotes like 'Tell 'em he's dreaming' and 'Straight to the pool room'."
  },
  {
    tip: "Hogan starred as Mick Dundee, showcasing Outback crocodile hunting skills, knife comparisons ('That's not a knife... THAT'S a knife'), and Manhattan culture shock.",
    explanation: "*Crocodile Dundee* (1986) was a global box-office smash, grossing over $328 million worldwide. Paul Hogan won a Golden Globe for Best Actor and received an Academy Award nomination for Best Original Screenplay."
  },
  {
    tip: "Set in a post-apocalyptic Australian wasteland, Gibson played highway patrol officer Max Rockatansky seeking vengeance against a brutal motorcycle gang.",
    explanation: "*Mad Max* (1979) held the Guinness World Record for the most profitable film relative to its budget for decades, costing $400,000 and grossing over $100 million internationally, launching director George Miller."
  },
  {
    tip: "Screenplay co-written by George Miller, the animatronic and live-action film featured James Cromwell as Farmer Hoggett ('That'll do, pig. That'll do').",
    explanation: "*Babe* (1995) received seven Academy Award nominations, including Best Picture and Best Director, winning the Oscar for Best Visual Effects for its seamless blending of live animals and animatronics."
  },

  // 40 - 49
  {
    tip: "Set in Antarctica, Mumble (voiced by Elijah Wood) cannot sing his 'heart-song' but possesses an extraordinary talent for tap-dancing.",
    explanation: "*Happy Feet* (2006), directed by George Miller and produced by Animal Logic in Sydney, became Australia's first winner of the Academy Award for Best Animated Feature."
  },
  {
    tip: "Starring Paul Mercurio as Scott Hastings and Tara Morice as Fran, the film introduced Luhrmann's signature hyper-stylized theatrical aesthetic.",
    explanation: "*Strictly Ballroom* (1992) premiered at the Cannes Film Festival where it won the Prix de la Jeunesse, launching Luhrmann's 'Red Curtain Trilogy' (followed by *Romeo + Juliet* and *Moulin Rouge!*)."
  },
  {
    tip: "Set in 1899 Paris, Ewan McGregor's Christian falls in love with Nicole Kidman's Satine at the iconic Montmartre cabaret.",
    explanation: "*Moulin Rouge!* (2001) revitalized the Hollywood movie musical genre. Nominated for eight Academy Awards including Best Picture, it won two Oscars for Best Art Direction and Best Costume Design."
  },
  {
    tip: "Hugo Weaving (Mitzi), Guy Pearce (Felicia), and Terence Stamp (Bernadette) lip-sync to ABBA and Opera while driving their bus 'Priscilla' across the Outback.",
    explanation: "*The Adventures of Priscilla, Queen of the Desert* (1994) won the Academy Award for Best Costume Design (Tim Chappel and Lizzy Gardiner, who famously wore a dress made of American Express cards)."
  },
  {
    tip: "Toni Collette starred as Muriel Heslop from Porpoise Spit, who dreams of a lavish wedding while listening to ABBA's *Dancing Queen*.",
    explanation: "Directed by P.J. Hogan, *Muriel's Wedding* (1994) earned critical acclaim worldwide, introducing Toni Collette and Rachel Griffiths to international audiences and winning four AFI Awards."
  },
  {
    tip: "Sam Neill played dish director Cliff Buxton, overseeing the 64-metre radio telescope in rural NSW despite power outages and windstorms.",
    explanation: "Produced by Working Dog, *The Dish* (2000) dramatized Australia's critical role in receiving and relaying prime live television footage of Neil Armstrong's first steps on the Moon during Apollo 11."
  },
  {
    tip: "Based on Louis de Bernières' novel, the film chronicles the real-life dog who traveled across Western Australia's mining towns uniting workers.",
    explanation: "*Red Dog* (2011), starring Koko as Red Dog alongside Josh Lucas and Rachael Taylor, became one of the highest-grossing Australian films of all time at the domestic box office."
  },
  {
    tip: "The mystery of Kane's dying word 'Rosebud' drives a news reporter to reconstruct the life of the timber tycoon turned press baron.",
    explanation: "Orson Welles was just 25 years old when he directed, co-wrote, and starred in *Citizen Kane* (1941). Renowned for its pioneering deep-focus photography, non-linear storytelling, and low camera angles, it frequently tops critics' polls as the greatest film ever made."
  },
  {
    tip: "Rick Blaine (Bogart) must choose between his love for Ilsa (Bergman) and helping her Resistance husband escape Nazi-occupied Morocco.",
    explanation: "*Casablanca* (1942) won three Academy Awards including Best Picture, Best Director (Michael Curtiz), and Best Screenplay. Immortalized by quotes like 'Here's looking at you, kid', it remains a classic of Hollywood's Golden Age."
  },
  {
    tip: "Coppola adapted Mario Puzo's bestselling novel, chronicling the Corleone family's transition of power from Don Vito to his reluctant son Michael (Al Pacino).",
    explanation: "*The Godfather* (1972) won three Academy Awards, including Best Picture and Best Actor for Marlon Brando. It revolutionized mob cinema and is universally regarded among the most influential films in motion picture history."
  },

  // 50 - 59
  {
    tip: "Filmed partly on location in Tunisia and California, Mark Hamill (Luke Skywalker), Harrison Ford (Han Solo), and Carrie Fisher (Princess Leia) starred.",
    explanation: "*Star Wars* (1977) revolutionized special effects through John Dykstra's Industrial Light & Magic. Grossing over $775 million, it birthed a multi-generational pop culture franchise spanning films, TV, and merchandise."
  },
  {
    tip: "Liam Neeson portrayed German industrialist Oskar Schindler, who saved more than 1,100 Polish-Jewish refugees by employing them in his factories.",
    explanation: "*Schindler's List* (1993) was shot in black-and-white by cinematographer Janusz Kamiński. Spielberg's masterpiece won seven Academy Awards, including Best Picture and Best Director."
  },
  {
    tip: "Leonardo DiCaprio (Jack Dawson) and Kate Winslet (Rose DeWitt Bukater) fall in love aboard the ill-fated RMS Titanic on its maiden voyage in 1912.",
    explanation: "James Cameron's *Titanic* (1997) was the first film to reach the billion-dollar mark, holding the title of highest-grossing film of all time for twelve years until Cameron's *Avatar* (2009)."
  },
  {
    tip: "Subtitled *The Return of the King*, it matched *Ben-Hur* and *Titanic* for the record of most Oscars won by a single movie (11).",
    explanation: "*The Lord of the Rings: The Return of the King* (2003) made Oscar history by sweeping all 11 categories in which it was nominated, including Best Picture—the first fantasy film ever to capture the top prize."
  },
  {
    tip: "Set on the lush alien moon of Pandora, Jake Sully (Sam Worthington) joins the Na'vi using 3D motion-capture digital technology.",
    explanation: "James Cameron's *Avatar* (2009) shattered global box-office records by grossing over $2.9 billion worldwide, pioneering 3D stereoscopic filmmaking and digital performance capture."
  },
  {
    tip: "Featuring classic songs by Rodgers and Hammerstein like *Over the Rainbow*, Dorothy follows the Yellow Brick Road to meet the Tin Man, Scarecrow, and Cowardly Lion.",
    explanation: "*The Wizard of Oz* (1939) made cinematic history through its vivid transition from sepia-tone Kansas to Technicolor Oz. It won two Academy Awards for Best Original Score and Best Original Song."
  },
  {
    tip: "Filmed on location in Salzburg, Austria, Julie Andrews leaves her convent to become governess to the seven children of Captain von Trapp.",
    explanation: "*The Sound of Music* (1965) won five Academy Awards including Best Picture. Featuring classic songs like *Do-Re-Mi* and *My Favorite Things*, it became one of the highest-grossing films of all time."
  },
  {
    tip: "Formed in Liverpool in 1960, the 'Fab Four' sparked Beatlemania worldwide with 20 Billboard Hot 100 number-one singles.",
    explanation: "The Beatles (John Lennon, Paul McCartney, George Harrison, Ringo Starr) are the best-selling music act of all time (over 600 million units sold). Their artistic evolution transformed popular music culture."
  },
  {
    tip: "Dubbed 'The World's Greatest Rock & Roll Band', their iconic tongue-and-lips logo was designed by John Pasche in 1970.",
    explanation: "The Rolling Stones (Mick Jagger, Keith Richards, Charlie Watts, Ronnie Wood) pioneered gritty blues-rock with classic albums like *Sticky Fingers* and *Exile on Main St.* across six decades."
  },
  {
    tip: "Freddie Mercury's multi-octave vocal range and Brian May's Red Special guitar crafted stadium rock anthems like *We Will Rock You* and *Bohemian Rhapsody*.",
    explanation: "Queen dominated international music across the 1970s and 80s, culminating in their legendary 21-minute performance at Live Aid at Wembley Stadium in July 1985."
  },

  // 60 - 69
  {
    tip: "Featuring Hipgnosis' iconic light prism album cover, the concept album spent a record-breaking 937 weeks on the Billboard 200 album chart.",
    explanation: "Pink Floyd (David Gilmour, Roger Waters, Richard Wright, Nick Mason) released *The Dark Side of the Moon* in 1973. Exploring themes of madness, time, and greed, it sold over 45 million copies worldwide."
  },
  {
    tip: "Jimmy Page's double-neck Gibson guitar and Robert Plant's vocals built this acoustic-to-hard-rock track featured on *Led Zeppelin IV* (1971).",
    explanation: "Led Zeppelin (Robert Plant, Jimmy Page, John Paul Jones, John Bonham) reshaped heavy metal and hard rock. *Stairway to Heaven* became the most requested song on US rock radio history."
  },
  {
    tip: "Produced by Quincy Jones, the album featured revolutionary music videos for *Billie Jean*, *Beat It*, and the 14-minute mini-movie *Thriller*.",
    explanation: "Michael Jackson's *Thriller* (1982) won eight Grammy Awards and remains the best-selling album in music history, with certified sales exceeding 70 million copies globally."
  },
  {
    tip: "Sun Records producer Sam Phillips recorded Elvis in Memphis, Tennessee, blending country, R&B, and gospel to launch a rockabilly revolution.",
    explanation: "Elvis Presley transformed popular culture in the 1950s. With 18 Billboard No. 1 hits and iconic TV appearances, he became the undisputed 'King of Rock and Roll'."
  },
  {
    tip: "Born Robert Zimmerman in Duluth, Minnesota, the folk icon composed anthems like *Blowin' in the Wind* and *Like a Rolling Stone*.",
    explanation: "Bob Dylan was awarded the 2016 Nobel Prize in Literature 'for having created new poetic expressions within the great American song tradition', becoming the first musician to receive the honor."
  },
  {
    tip: "Bruce Springsteen and the E Street Band recorded raw rock anthems capturing American working-class life and blue-collar struggles.",
    explanation: "Bruce Springsteen earned the nickname 'The Boss' for his legendary three-hour-plus live performances. His 1984 album *Born in the U.S.A.* produced seven Top 10 Billboard singles."
  },
  {
    tip: "Formed by early childhood educators at Macquarie University, the blue, red, yellow, and purple skivvy-wearing group became a global children's empire.",
    explanation: "The Wiggles have entertained generations of children worldwide for over three decades with songs like *Fruit Salad* and *Hot Potato*, winning 15 ARIA Music Awards."
  },
  {
    tip: "Famous for its 'Through the Windows' segment (arch, round, or diamond) and iconic toys Big Ted, Little Ted, Jemima, and Humpty.",
    explanation: "*Play School* is Australia's longest-running children's television program, broadcasting on the ABC since July 1966 and nurturing generations of preschoolers."
  },
  {
    tip: "Created by Joe Brumm and produced by Ludo Studio in Brisbane, the show captures everyday Australian family life in subtropical Queensland.",
    explanation: "*Bluey* won an International Emmy Kids Award and became a global streaming powerhouse on Disney+, praised by critics for its heartfelt depiction of imaginative play and parenting."
  },
  {
    tip: "McCormack was the lead singer and guitarist for 1990s Brisbane indie rock band Custard before being cast as the loveable, fun-loving dad.",
    explanation: "David McCormack provides the warm, improvisational voice of Bandit Heeler in *Bluey*, winning international fan acclaim for his portrayal of engaged modern fatherhood."
  },

  // 70 - 79
  {
    tip: "Zanetti studied at the University of Southern Queensland and Arts Educational Schools in London before voicing the wise, caring mother.",
    explanation: "Melanie Zanetti voices Chilli Heeler in *Bluey*, providing a balanced, realistic, and affectionate portrait of modern motherhood."
  },
  {
    tip: "Hamish Blake and Andy Lee met at the University of Melbourne before launching their comedy pairing on commercial radio and podcasts.",
    explanation: "Hamish & Andy dominated Australian drive radio on the Today Network, winning multiple ACRA awards before transitioning to Australia's top-charting comedy podcast."
  },
  {
    tip: "Doyle (HG) and Pickhaver (Roy) delivered deadpan satirical commentary on *This Sporting Life* on Triple J and Olympic broadcasts *The Dream*.",
    explanation: "Roy & HG created legendary sports commentary satire across radio and television for four decades, introducing terms like 'the flat-bag' and 'the hello boys'."
  },
  {
    tip: "Founded by Charles Firth, Craig Reucassel, Julian Morrow, Dominic Knight, and Chas Licciardello as a satirical newspaper in Sydney.",
    explanation: "The Chaser comedy group gained national notoriety for daring political stunts, including infiltrating the APEC summit security zone in Sydney dressed as Osama bin Laden in 2007."
  },
  {
    tip: "Featuring Ian McFadyen, Anthony Morgan, Shaun Micallef, and future Working Dog founders, the comedy collective spawned *The Late Show* on the ABC.",
    explanation: "*The D-Generation* aired on Ten and ABC in the late 80s, serving as the launching pad for many of Australia's premier television writers, performers, and producers."
  },
  {
    tip: "Produced by Artist Services in Melbourne, the show featured iconic parodies of newsreaders, commercials, and soap operas like *Dynasty*.",
    explanation: "*Fast Forward* ran from 1989 to 1992 on Seven, becoming Australia's highest-rating sketch comedy show starring Steve Vizard, Magda Szubanski, Marg Downey, and Michael Veitch."
  },
  {
    tip: "Mitchell wore a grease-smudged apron and pencil behind his ear to play the Melbourne greengrocer famous for the catchphrase 'Bewtiful, mate!'.",
    explanation: "*The Comedy Company* (1988-1990) on Network Ten dominated Sunday night ratings, creating cultural figures like Con the Fruiterer and Kylie Mole (Kim Gyngell)."
  },
  {
    tip: "Featuring team captains Mikey Robins and Jo Stanley alongside host Paul McDermott, the show turned weekly news headlines into comedy panel games.",
    explanation: "*Good News Week* ran across the ABC and Network Ten, blending political satire, news trivia, and musical comedy performances."
  },
  {
    tip: "Panelists Todd Sampson and Russell Howcroft break down advertising strategies, spin campaigns, and brand marketing tactics each week.",
    explanation: "*Gruen* (originally *The Gruen Transfer*) has aired on the ABC since 2008, analyzing the persuasiveness of consumer advertising and public relations."
  },
  {
    tip: "Host Tom Gleeson grills contestants on niche specialist subjects before subjecting them to the ruthless 'Hard Wipe' round.",
    explanation: "*Hard Quiz* debuted on the ABC in 2016, earning Gleeson the Gold Logie in 2019 off the back of his abrasive, self-deprecating hosting style."
  },

  // 80 - 89
  {
    tip: "Hills hosted alongside team captains Myf Warhurst and Alan Brough, taking its title from the 1966 Australian pop song by Daddy Cool.",
    explanation: "*Spicks and Specks* ran for 277 episodes on the ABC between 2005 and 2011, becoming a beloved Sunday night music quiz show featuring musical guest panellists."
  },
  {
    tip: "Featuring the RocKwiz Orkestra, contestants competed alongside guest musical legends who performed live duets at the end of every episode.",
    explanation: "*RocKwiz* aired on SBS for 14 seasons from 2005, celebrating rock trivia and live music performance from Melbourne's iconic St Kilda venue."
  },
  {
    tip: "Speers spent 19 years at Sky News Australia before replacing Barrie Cassidy as host of the ABC's Sunday political interview program in 2020.",
    explanation: "David Speers is one of Australia's premier political journalists, winning Walkley Awards for his sharp interviews with federal politicians and election leaders debates."
  },
  {
    tip: "Sales conducted tough interviews with prime ministers and global leaders on *7.30* before stepping down to author bestsellers and host *Storytellers*.",
    explanation: "Leigh Sales hosted the ABC's flagship nightly current affairs program *7.30* for 12 years (2011-2022), winning three Walkley Awards for journalism."
  },
  {
    tip: "O'Brien was the founding anchor of *The 7.30 Report* in 1995 and interviewed seven Australian prime ministers across his distinguished ABC career.",
    explanation: "Kerry O'Brien is a titan of Australian broadcast journalism, winning six Walkley Awards and anchoring *Four Corners*, *Lateline*, and *The 7.30 Report*."
  },
  {
    tip: "Crabb cooks meals with Australian politicians in their private homes to discuss their personal lives, political careers, and upbringing.",
    explanation: "Annabel Crabb is a prominent Australian political journalist, author, and ABC presenter known for her sharp political commentary and lighthearted culinary interviews on *Kitchen Cabinet*."
  },
  {
    tip: "Barry reviews newspaper headlines, broadcast reporting, and social media spin, pointing out journalistic lapses and conflicts of interest.",
    explanation: "*Media Watch* has aired on the ABC since 1989 as Australia's premier watchdog on media ethics, accuracy, and journalistic integrity."
  },
  {
    tip: "Inaugurated by Michael Charlton in 1961, the program has uncovered major national political scandals, corruption, and social injustice.",
    explanation: "*Four Corners* is Australia's premier investigative journalism program. Airing on ABC for over 60 years, its reporting has triggered Royal Commissions and government reforms."
  },
  {
    tip: "Modeled on the US CBS news magazine format, the Nine Network series featured reporters like George Negus, Ian Leslie, Ray Martin, and Jana Wendt.",
    explanation: "*60 Minutes* launched in Australia in 1979 under producer Gerald Stone, becoming the country's dominant Sunday night current affairs program for decades."
  },
  {
    tip: "McGuire hosted the game show on Nine Network while serving as president of the Collingwood Football Club and CEO of Nine.",
    explanation: "Eddie McGuire earned the nickname 'Eddie Everywhere' for his pervasive presence across Australian sports broadcasting, game show hosting, and football administration."
  },

  // 90 - 99
  {
    tip: "Somers hosted the Saturday night variety show featuring live stunts, cartoons, and characters like Ossie Ostrich (Ernie Carroll) and Plucka Duck.",
    explanation: "*Hey Hey It's Saturday* ran on the Nine Network from 1971 to 1999, reigning as Australia's dominant weekend family variety and comedy show."
  },
  {
    tip: "Kennedy hosted *In Melbourne Tonight* (IMT) and *Blankety Blanks*, famous for live ad-libbing, crow calls ('Faaaark!'), and irreverent humor.",
    explanation: "Graham Kennedy was affectionately dubbed 'The King' of Australian television, winning five Gold Logies and pioneering live comedy broadcasting."
  },
  {
    tip: "Newton served as Kennedy's straight man on IMT, earned the nickname 'Moonface', and presented the Logie Awards a record 19 times.",
    explanation: "Bert Newton was a beloved icon of Australian television for over six decades, starring on *Good Morning Australia*, *The Don Lane Show*, and *20 to 1*."
  },
  {
    tip: "Lane ('The Lanky Yank') co-hosted the late-night variety show with Bert Newton, featuring live satellite interviews with Hollywood stars.",
    explanation: "*The Don Lane Show* ran on Nine from 1975 to 1983, bringing American-style late-night chat, big band numbers, and illusionists to Australian television."
  },
  {
    tip: "Walsh pioneered morning and midday television, winning the Gold Logie in 1980 for his popular talk and entertainment format.",
    explanation: "*The Mike Walsh Show* dominated Australian daytime television from 1973 to 1985 on Nine, featuring lifestyle reporting, live musical performances, and celebrity interviews."
  },
  {
    tip: "Martin hosted *Midday with Ray Martin* for nearly a decade, winning five Gold Logies before anchoring *A Current Affair*.",
    explanation: "Ray Martin is one of Australian television's most recognized news and interview personalities, spending over 40 years across Nine and SBS."
  },
  {
    tip: "Kennerley hosted *Good Morning Australia* on Ten and *Midday* on Nine, becoming a staple of Australian daytime lifestyle TV.",
    explanation: "Kerri-Anne Kennerley enjoyed a 50-year career in Australian television, inducted into the Logies Hall of Fame in 2017."
  },
  {
    tip: "Grimshaw anchored Nine's flagship weeknight current affairs show for 17 years, recognized for her empathetic yet probing interview style.",
    explanation: "Tracy Grimshaw was a cornerstone of Nine Network journalism, co-hosting *Today* for a decade before leading *A Current Affair* from 2006 to 2022."
  },
  {
    tip: "Willesee revolutionized hard-hitting current affairs interviewing, famously utilizing dramatic pauses and silence to unnerves politicians.",
    explanation: "Mike Willesee was a giant of Australian television journalism, creating *A Current Affair* in 1971 and anchoring *Documentaries* and *10 Late News*."
  },
  {
    tip: "Wendt's fierce intelligence, glamorous style, and razor-sharp questioning earned her a Gold Logie and top ratings on *A Current Affair* and *60 Minutes*.",
    explanation: "Jana Wendt was one of Australia's most formidable television journalists, anchoring *A Current Affair*, *Dateline*, and *Witness*."
  },

  // 100 - 115
  {
    tip: "Keneally won the 1982 Booker Prize for his novel based on Poldek Pfefferberg's Holocaust eyewitness accounts.",
    explanation: "Thomas Keneally is one of Australia's premier historical novelists. His book *Schindler's Ark* was adapted by Steven Spielberg into the Oscar-winning film *Schindler's List*."
  },
  {
    tip: "Carrey plays Truman Burbank, who discovers his entire coastal town of Seahaven is a massive television soundstage broadcast 24/7 to the world.",
    explanation: "Directed by Peter Weir from a script by Andrew Niccol, *The Truman Show* (1998) presciently anticipated reality TV culture and mass surveillance, earning three Academy Award nominations."
  },
  {
    tip: "Weir directed Australian classic *Picnic at Hanging Rock* (1975) before crafting Hollywood hits *Witness*, *Dead Poets Society*, and *Master and Commander*.",
    explanation: "Peter Weir is one of Australia's most revered film directors, receiving an Honorary Academy Award in 2022 for his decades of cinematic excellence."
  },
  {
    tip: "Noyce directed Australian classics *Newsfront* and *Rabbit-Proof Fence* alongside major Tom Clancy Hollywood action blockbusters starring Harrison Ford.",
    explanation: "Phillip Noyce successfully bridged Australian art-house cinema and big-budget Hollywood action thrillers throughout his career."
  },
  {
    tip: "Beresford directed *Breaker Morant* during the Australian Film Renaissance before winning the Best Picture Oscar for *Driving Miss Daisy*.",
    explanation: "Bruce Beresford was a pivotal figure in the revival of Australian cinema in the 1970s and 80s, directing over 30 feature films internationally."
  },
  {
    tip: "Armstrong directed Judy Davis in *My Brilliant Career* (1979) and Winona Ryder in the acclaimed 1994 adaptation of Louisa May Alcott's novel.",
    explanation: "Gillian Armstrong was a pioneering female director of the Australian New Wave, celebrated for her character-driven period dramas and feminist themes."
  },
  {
    tip: "Campion won the Palme d'Or for *The Piano* (1993) starring Holly Hunter and Anna Paquin, cementing her place in international cinema history.",
    explanation: "Jane Campion is a New Zealand filmmaker who made cinema history as the first woman to win the Palme d'Or at Cannes and the second woman to win the Best Director Oscar."
  },
  {
    tip: "Set in 1925 Montana, Benedict Cumberbatch stars as menacing rancher Phil Burbank alongside Kirsten Dunst and Jesse Plemons.",
    explanation: "*The Power of the Dog* (2021) received 12 Academy Award nominations, earning Jane Campion the Best Director Oscar 28 years after her nomination for *The Piano*."
  },
  {
    tip: "Jackman debuted as the adamantium-clawed mutant in 2000's *X-Men*, holding the Guinness World Record for the longest career as a live-action Marvel character.",
    explanation: "Hugh Jackman played Wolverine across nine films over 24 years, culminating in *Logan* (2017) and *Deadpool & Wolverine* (2024)."
  },
  {
    tip: "Hemsworth was cast as the Norse God of Thunder in 2011, starring in four standalone *Thor* movies and four *Avengers* team-up blockbusters.",
    explanation: "Chris Hemsworth transformed into a global superstar playing Thor in the Marvel Cinematic Universe, earning accolades for blending action prowess with comedy timing."
  },
  {
    tip: "Robbie produced and starred in *Barbie* (2023), which grossed over $1.44 billion worldwide and became Warner Bros.' highest-grossing film in history.",
    explanation: "Margot Robbie established her LuckyChap Entertainment production company while starring in critically acclaimed films like *The Wolf of Wall Street*, *I, Tonya*, and *Once Upon a Time in Hollywood*."
  },
  {
    tip: "Collette delivered a terrifying lead performance as Annie Graham in Ari Aster's *Hereditary* (2018) and played Joni Thrombey in Rian Johnson's whodunit.",
    explanation: "Toni Collette is one of Australia's most versatile acting exports, nominated for an Oscar for *The Sixth Sense* (1999) and winning Emmy and Golden Globe awards for *United States of Tara*."
  },
  {
    tip: "Snook won two Golden Globe Awards and an Emmy for playing Siobhan 'Shiv' Roy, the cunning daughter of media tycoon Logan Roy (Brian Cox).",
    explanation: "Sarah Snook earned universal critical acclaim across four seasons of HBO's multi-award-winning drama series *Succession* (2018-2023)."
  },
  {
    tip: "Byrne showcased her comedy mastery as Helen Harris in *Bridesmaids* (2011) and starred in Apple TV+'s 1980s dark comedy series *Physical*.",
    explanation: "Rose Byrne successfully transitioned from dramatic roles in *Damages* to acclaimed comedic performances in Hollywood studio films."
  },
  {
    tip: "Fisher starred as Gloria Cleary in *Wedding Crashers* (2005) and shopaholic Rebecca Bloomwood in the hit romantic comedy adaptation.",
    explanation: "Isla Fisher got her start on *Home and Away* before building a successful comedy career in Hollywood."
  },
  {
    tip: "Wilson played 'Fat Amy' in the hit musical comedy franchise *Pitch Perfect* (2012-2017), winning MTV Movie and Teen Choice Awards.",
    explanation: "Rebel Wilson broke through in Hollywood with *Bridesmaids* before writing, producing, and starring in major international comedy feature films."
  }
];

if (updates.length !== pop.length) {
  console.error(`Error: updates length (${updates.length}) !== pop length (${pop.length})`);
  process.exit(1);
}

for (let i = 0; i < pop.length; i++) {
  pop[i].tip = updates[i].tip;
  pop[i].explanation = updates[i].explanation;
}

fs.writeFileSync(popPath, JSON.stringify(pop, null, 2), 'utf8');
console.log('Successfully updated popCultureNews.json with audited tips and explanations!');
