/* ===== Study Quest: app logic (no external dependencies). Guide-specific values come from window.GUIDE. ===== */
(function(){
const GUIDE=window.GUIDE||{id:'cs379',name:'CS 379 Study Quest',short:'CS 379',storageKey:'cs379q3',legacyKeys:['cs379q'],extraChapterNames:{E:'Email'}};
const LK=(window.CSQ_LOOKS&&Object.prototype.hasOwnProperty.call(window.CSQ_LOOKS,GUIDE.look)&&window.CSQ_LOOKS[GUIDE.look])||null; /* optional per-guide look (shared/looks.js); null = the built-in cyber look */
const XP=String(GUIDE.id||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const $=s=>document.querySelector(s),main=$('#main');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const KEYS=Object.keys(CH);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const KIND={s:'Scenario',d:'Definition',a:'Acronym'};
const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const chName=c=>(GUIDE.extraChapterNames&&GUIDE.extraChapterNames[c])||'Ch '+c;

/* ---------- state ---------- */
const SK=GUIDE.storageKey;
let S={name:'',xp:0,hist:[],theme:null,snd:1,mus:1,known:{},cd:{},badges:{},best:0,ans:0,cor:0,bestTest:0,bestQuiz:0,rivals:[],qs:0};
try{let raw=localStorage.getItem(SK);if(!raw){for(const lk of (GUIDE.legacyKeys||[])){raw=localStorage.getItem(lk);if(raw)break}if(raw){const o=JSON.parse(raw);delete o.done;o.cd={};raw=JSON.stringify(o)}}if(raw)Object.assign(S,JSON.parse(raw))}catch(e){}
/* validate everything read from storage: it is untrusted input */
(function clean(){const num=(v,max)=>{v=Math.floor(+v);return Number.isFinite(v)&&v>=0?Math.min(v,max):0};const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  S.name=typeof S.name==='string'&&/^[A-Z0-9]{3}$/.test(S.name)?S.name:'';
  ['xp','best','ans','cor','qs'].forEach(k=>S[k]=num(S[k],1e7));S.bestTest=num(S.bestTest,100);S.bestQuiz=num(S.bestQuiz,100);
  S.theme=S.theme==='dark'||S.theme==='light'?S.theme:null;S.snd=S.snd?1:0;S.mus=S.mus?1:0;S.skip=S.skip?1:0;
  S.acc=typeof S.acc==='string'&&/^[a-z]{2,10}$/.test(S.acc)?S.acc:'cyber';
  S.known=obj(S.known);S.cd=obj(S.cd);S.badges=obj(S.badges);delete S.rivals;
  S.hist=Array.isArray(S.hist)?S.hist.filter(h=>h&&typeof h==='object').slice(-200).map(h=>({mode:h.mode==='test'?'test':'quiz',scope:String(h.scope||'').slice(0,80),pct:num(h.pct,100),n:num(h.n,1e4),t:num(h.t,1e14)})):[];
})();
const save=()=>{try{localStorage.setItem(SK,JSON.stringify(S))}catch(e){}};

/* ---------- question bank ---------- */
const ALLQ=[];
STATIC.forEach((a,i)=>{if(String(a[0])==='12')return;ALLQ.push({k:'s'+i,c:String(a[0]),t:a[1],q:a[2],o:a[3],a:a[4],e:a[5]||'',i:a[6]||'',src:a[7]||''})});
const GR=[['OSINT','Footprinting','Passive reconnaissance','Active reconnaissance','Whois','Metadata'],['Ping','Ping sweep','Fping','ICMP'],['Wireshark','TCPDump','Sniffer','Passive sniffing','Active sniffing','Promiscuous mode'],['Malware','Virus','Worm','Trojan','Logic bomb','Hoax','Polymorphic virus','Multipartite virus','Macro virus','Boot sector virus','RAT','Spyware','Adware','Scareware','Ransomware','Backdoor','Rootkit','Wrapper'],['WEP','WPA','WPA2','WPA3','PSK','SAE','AES-CCMP','RSN'],['Port scanning','Open port','Closed port','Filtered port','Banner grabbing'],['TCP connect scan','SYN scan (half-open)','FIN scan','NULL scan','XMAS scan','ACK scan','UDP scan','Nmap','Zenmap','Masscan','ZMap'],['DoS','DDoS','SYN flood','Smurf attack','Ping flood','Fragmentation attack','Botnet','LOIC'],['Infrastructure mode','Ad hoc network','AP','BSS','ESS','DS','BSSID','SSID','STA','Roaming'],['XSS','Stored XSS','Reflected XSS','CSP','Injection','SQL injection','Prepared statement'],['Man-in-the-middle','ARP poisoning','ARP','MAC flooding','Session hijacking','Ettercap','Dsniff'],['OS fingerprinting','Active fingerprinting','Passive fingerprinting','p0f','XProbe2'],['Privilege escalation','POLP','LinPEAS','SYSTEM account','Local Service','Network Service'],['Hub','Switch','CAM table'],['Dictionary attack','Hybrid attack','Brute-force attack','Rainbow table','Offline attack','Passive online attack','Active online attack','Salt','Hash','Shoulder surfing','Ophcrack','John the Ripper','Hashcat','THC-Hydra','Cain & Abel','RainbowCrack','CrackStation'],['DNS','FQDN','TLD','Root DNS server','Zone transfer','DNS registrar','NS record','MX record','PTR record','A record','Nslookup','Non-authoritative answer'],['IANA','ICANN','RIR','ARIN','RIPE NCC','APNIC','AFRINIC','LACNIC'],['Beacon','Probe request','Deauthentication','Management frame','Control frame','Data frame','Frame','FCS','RTS/CTS','NAV','TBTT','CSMA/CA','CSMA/CD'],['Bluejacking','Bluesnarfing','Bluebugging'],['Evil twin','Rogue access point','MAC filtering','Emanations'],['Broken authentication','Broken access control','IDOR','Security misconfiguration','Sensitive data exposure','Session ID'],['SPF','DKIM','DMARC','Authentication-Results'],['Static analysis','Dynamic analysis','OllyDbg','Ghidra','VirusTotal'],['Covert channel','TCSEC','Port redirection'],['Directory traversal','Buffer overflow','Upload bombing','Poison null byte'],['Shodan','Censys','BuiltWith','Netcraft'],['Sublist3r','TheHarvester','Recon-ng','Maltego'],['PST','OST','EDB','ESE','Recoverable Items','Mailbox audit log'],['Received header','Return-Path','Message-ID','Mapi-Client-Submit-Time','Mapi-Message-Flags'],['SMB','NetBIOS','RPC','RDP','SNMP','LDAP','nbtstat','net view','netstat','NULL session','IPC$']];
const conf=(a,b)=>GR.some(r=>r.includes(a)&&r.includes(b));
(function gen(){
  const byCh={};G.forEach(g=>(byCh[g[0]]=byCh[g[0]]||[]).push(g));
  const pick=(arr,n,ex)=>{const out=[],seen=new Set(ex);for(const x of shuffle(arr)){if(!seen.has(x)){seen.add(x);out.push(x);if(out.length===n)break}}return out};
  G.forEach((g,gi)=>{const c=g[0],t=g[1],x=g[2],d=g[3];
    const okh=h=>h!==g&&!conf(t,h[1]),same=byCh[c].filter(okh),rest=G.filter(h=>h[0]!==c&&okh(h));
    let made=false;
    if(x){
      const ac=G.filter(h=>h[2]&&h!==g&&h[2].toLowerCase()!==x.toLowerCase()&&!(h[1]===t));
      const d3=pick(ac.filter(h=>h[0]===c),3,[]).concat(pick(ac.filter(h=>h[0]!==c),3,[])).slice(0,3).map(h=>h[2]);
      const o=[x].concat(d3);
      if(o.length===4){ALLQ.push({k:'ga'+gi,c,t:'a',q:'What does the acronym '+t+' stand for?',o,a:0,e:t+' stands for '+x+'. '+d,i:'',src:'glossary'});made=true}
    }
    /* one question per row: the acronym question above, or this description question for rows without one (or whose acronym question cannot get 3 distractors) */
    if(!made&&d.length>25){
      const dd=pick(same,3,[]);if(dd.length<3)dd.push(...pick(rest,3-dd.length,dd));
      ALLQ.push({k:'gd'+gi,c,t:'d',q:'Which term matches this description? "'+d+'"',o:[t].concat(dd.map(h=>h[1])),a:0,e:t+(x?' ('+x+')':'')+': '+d,i:'',src:'glossary'});
    }
  });
})();
const POOLN=c=>ALLQ.filter(q=>q.c===c).length;
const prog=c=>{const n=Object.keys(S.cd).filter(k=>S.cd[k]===c).length;return Math.min(100,Math.round(100*n/Math.min(60,POOLN(c)||1)))};

/* ---------- levels, ranks, badges ---------- */
const PER=150,TT=(LK&&LK.titles)||["Script Kiddie","Recon Rookie","Packet Sniffer","Port Hunter","Shell Popper","Pen Tester","Red Teamer","Exploit Dev","Root Admin","Zero-Day Legend"];
const lvl=()=>Math.floor(S.xp/PER)+1,ttl=n=>TT[Math.min((n||lvl())-1,TT.length-1)];
const BD=[['first','🩸','First Blood',()=>S.cor>=1],['s5','🔥','5 Streak',()=>S.best>=5],['s10','⚡','10 Streak',()=>S.best>=10],['perf','💎','Perfect Round',()=>S.hist.some(h=>h.pct===100&&h.n>=5)],['t80','🎯','Test 80%+',()=>S.bestTest>=80],['k30','🧠','30 Cards Known',()=>Object.keys(S.known).length>=30],['k100','📚','100 Cards Known',()=>Object.keys(S.known).length>=100],['l5','🚀','Level 5',()=>lvl()>=5],['c3','🏆','3 Chapters 90%+',()=>KEYS.filter(c=>prog(c)>=90).length>=3],['a100','💯','100 Answered',()=>S.ans>=100],['a500','🛰','500 Answered',()=>S.ans>=500]];

/* ---------- animated logos ---------- */
let lid=0;
function logo(sz,big){const u='l'+(++lid);
  if(LK)return LK.logo(u,sz,big,GUIDE.name+' logo: '+LK.logoDesc);
  return '<svg class="logo" viewBox="0 0 64 64" width="'+sz+'" height="'+sz+'" role="img" aria-label="'+esc(GUIDE.name)+' logo: a shield with a rotating radar sweep and blinking targets" style="color:var(--ac);overflow:visible"><defs><linearGradient id="'+u+'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ac)"/><stop offset="1" style="stop-color:var(--ac2)"/></linearGradient><clipPath id="'+u+'c"><path d="M32 3L57 12V32C57 47 46 57 32 61C18 57 7 47 7 32V12Z"/></clipPath></defs>'
  +(big?'<circle class="ringp" cx="32" cy="32" r="34" fill="none" stroke="url(#'+u+'g)" stroke-width="1.2"/><circle class="ringp r2" cx="32" cy="32" r="34" fill="none" stroke="url(#'+u+'g)" stroke-width="1.2"/>':'')
  +'<path d="M32 3L57 12V32C57 47 46 57 32 61C18 57 7 47 7 32V12Z" style="fill:rgba(var(--net),.10)" stroke="url(#'+u+'g)" stroke-width="3" stroke-linejoin="round"/><g clip-path="url(#'+u+'c)"><circle cx="32" cy="34" r="9" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1"/><circle cx="32" cy="34" r="18" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/><path d="M32 8V60M6 34H58" stroke="currentColor" stroke-opacity=".25"/><g class="sweep" style="transform-box:view-box"><path d="M32 34L32 12A22 22 0 0 1 51 23Z" fill="url(#'+u+'g)" opacity=".55"/></g><circle class="blip" cx="42" cy="26" r="2.4" style="fill:var(--ac)"/><circle class="blip b2" cx="23" cy="42" r="2.4" style="fill:var(--ac2)"/><circle class="blip b3" cx="38" cy="45" r="2" style="fill:var(--ac)"/></g></svg>'}
function emblem(n){return '<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Level badge: a shield with a star"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ac)"/><stop offset="1" style="stop-color:var(--ac2)"/></linearGradient></defs><path d="M60 6L106 22V60C106 88 86 106 60 114C34 106 14 88 14 60V22Z" style="fill:rgba(var(--net),.15)" stroke="url(#eg)" stroke-width="5" stroke-linejoin="round"/><g class="star"><path d="M60 28l9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3z" fill="url(#eg)"/></g></svg>'}

/* ---------- audio: sound effects + per-guide music (techno / ambient / ethereal) ---------- */
let AC=null,master,musBus,sfxBus,musGain,delayN,musTimer=null,step=0,nextT=0;
function ensureAudio(){
  if(AC)return AC;
  try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C();
    master=AC.createGain();master.gain.value=.9;master.connect(AC.destination);
    musGain=AC.createGain();musGain.gain.value=0;musGain.connect(master);
    musBus=AC.createGain();musBus.gain.value=.34;musBus.connect(musGain);
    delayN=AC.createDelay(1);delayN.delayTime.value=.36;const fb=AC.createGain();fb.gain.value=.32;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
    musBus.connect(delayN);delayN.connect(lp);lp.connect(fb);fb.connect(delayN);lp.connect(musGain);
    sfxBus=AC.createGain();sfxBus.gain.value=.22;sfxBus.connect(master);
  }catch(e){AC=null}
  return AC;
}
const mtof=m=>440*Math.pow(2,(m-69)/12);
function tone(bus,f,t,dur,type,vol,atk){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(atk||.01));g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.05)}
function beep(f,d,type){if(!S.snd||!ensureAudio())return;try{if(AC.state==='suspended')AC.resume();tone(sfxBus,f,AC.currentTime,d||.14,type||'sine',.7,.005)}catch(e){}}
const sfx={ok(){beep(660,.12);setTimeout(()=>beep(880,.16),90)},bad(){beep(180,.25,'sawtooth')},lvl(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.2,'triangle'),i*110))},tick(){beep(520,.05,'square')},click(){beep(420,.05,'triangle')}};
/* Original music, one song per guide look (all melodies original). Notes: [16th-step, midi note, length in 16ths].
   default = techno (CS 379), origins = ambient (CR 370), cosmos = ethereal (SC 141). */
const SONGS={
 default:{name:'Lobby Techno',bpm:128,lead:'square',leadVol:.05,style:'techno',delay:3,gain:1,
  chords:[[45,[0,3,7]],[41,[0,4,7]],[48,[0,4,7]],[43,[0,4,7]],[45,[0,3,7]],[41,[0,4,7]],[48,[0,4,7]],[43,[0,4,7]]],
  mel:[[[0,69,1],[3,72,1],[6,76,2],[10,72,1],[12,74,2]],
       [[0,72,1],[3,69,1],[6,77,2],[10,76,1],[12,72,2]],
       [[0,72,1],[3,76,1],[6,79,2],[10,76,1],[12,74,2]],
       [[0,71,1],[3,74,1],[6,79,2],[10,74,1],[12,71,2],[14,74,1]],
       [[0,69,1],[3,72,1],[6,76,2],[10,72,1],[12,74,2]],
       [[0,72,1],[3,69,1],[6,77,2],[10,76,1],[12,72,2]],
       [[0,79,1],[3,76,1],[6,72,2],[10,76,1],[12,79,2]],
       [[0,74,1],[3,71,1],[6,67,2],[10,71,1],[12,74,1],[14,76,1]]]},
 origins:{name:'Still Waters',bpm:70,lead:'sine',leadVol:.07,style:'ambient',delay:6,gain:1.6,
  chords:[[43,[0,4,7,11]],[38,[0,4,7,9]],[40,[0,3,7,10]],[36,[0,4,7,11]],[43,[0,4,7,9]],[36,[0,4,7,11]],[38,[0,4,7,9]],[43,[0,4,7,11]]],
  mel:[[[0,74,8],[8,79,8]],[[4,78,12]],[[0,71,8],[8,74,8]],[[0,76,16]],
       [[0,79,6],[6,76,4],[10,74,6]],[[0,72,8],[8,76,8]],[[0,74,8],[8,78,8]],[[0,79,16]]]},
 cosmos:{name:'Starlight',bpm:84,lead:'sine',leadVol:.065,style:'ethereal',delay:6,gain:2.5,
  chords:[[45,[0,3,7,10]],[41,[0,4,7,11]],[48,[0,4,7,11]],[43,[0,4,7,9]],[45,[0,3,7,10]],[41,[0,4,7,11]],[43,[0,4,7,9]],[40,[0,4,7,10]]],
  mel:[[[0,76,6],[6,81,10]],[[0,77,8],[8,72,8]],[[0,79,6],[6,84,10]],[[0,79,8],[8,74,8]],
       [[0,76,4],[4,81,4],[8,83,8]],[[0,84,8],[8,81,8]],[[0,79,8],[8,76,8]],[[0,76,16]]]}
};
const SONG=SONGS[GUIDE.look]||SONGS.default;
const SIXTEENTH=60/SONG.bpm/4;
function noise(t,dur,vol,type,freq){const n=Math.max(1,AC.sampleRate*dur|0),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=AC.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(musBus);s.start(t)}
function hat(t,vol,len){noise(t,len||.04,vol,'highpass',7500)}
function clap(t,vol){noise(t,.12,vol,'bandpass',1500);noise(t+.012,.1,vol*.7,'bandpass',1500)}
function kick(t,vol){const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.11);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.26);o.connect(g);g.connect(musBus);o.start(t);o.stop(t+.3)}
/* swelling pad: slow attack, long release */
function pad(m,t,dur,type,vol){const o=AC.createOscillator(),g=AC.createGain(),up=Math.min(1.2,dur*.3);o.type=type;o.frequency.value=mtof(m);o.detune.value=(Math.random()*8-4);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+up);g.gain.setValueAtTime(vol,t+dur);g.gain.exponentialRampToValueAtTime(.0001,t+dur+1.6);o.connect(g);g.connect(musBus);o.start(t);o.stop(t+dur+1.7)} /* holds through the bar, then crossfades into the next chord */
function bell(m,t,dur,vol){tone(musBus,mtof(m),t,dur,'sine',vol,.006);tone(musBus,mtof(m)*2.005,t,dur*.45,'sine',vol*.3,.004);tone(musBus,mtof(m)*3.01,t,dur*.2,'sine',vol*.12,.003)}
function playStep(n,t){
  const bar=Math.floor(n/16)%SONG.mel.length,s=n%16,ch=SONG.chords[bar],root=ch[0],q=ch[1],u=SIXTEENTH,BAR=16*u;
  if(SONG.style==='techno'){
    SONG.mel[bar].forEach(x=>{if(x[0]===s){tone(musBus,mtof(x[1]),t,x[2]*u*.85,'square',SONG.leadVol,.004);tone(musBus,mtof(x[1]+12),t,x[2]*u*.6,'sawtooth',SONG.leadVol*.25,.004)}});
    if(s%4===0)kick(t,.62);                                   /* four on the floor */
    if(s===4||s===12)clap(t,.14);
    hat(t,s%4===2?.07:.025,s%4===2?.12:.03);                 /* 16th closed hats + off-beat open hat */
    if(s%4===2)tone(musBus,mtof(root),t,u*1.6,'sawtooth',.16,.004);       /* off-beat bass pulse */
    if(s%4===3)tone(musBus,mtof(root+12),t,u*.8,'square',.06,.003);
    if(s===0)q.forEach(x=>pad(root+24+x,t,BAR,'triangle',.016));         /* thin chord bed */
  }else if(SONG.style==='ambient'){
    if(s===0){q.forEach(x=>{pad(root+12+x,t,BAR,'sine',.045);pad(root+24+x,t,BAR,'triangle',.018)});pad(root,t,BAR,'sine',.09)}
    SONG.mel[bar].forEach(x=>{if(x[0]===s)bell(x[1],t,Math.min(4,x[2]*u*1.4),SONG.leadVol)});
    if(s===8&&bar%2===1)bell(root+36+q[2],t,2.5,.02);        /* rare high sparkle */
  }else{ /* ethereal */
    if(s===0){q.forEach(x=>{pad(root+24+x,t,BAR,'triangle',.022);pad(root+36+x,t,BAR,'sine',.012)});pad(root+12,t,BAR,'sine',.05)}
    SONG.mel[bar].forEach(x=>{if(x[0]===s)bell(x[1],t,Math.min(4.5,x[2]*u*1.6),SONG.leadVol)});
    if(s%2===0){const x=q[(s>>1)%q.length];tone(musBus,mtof(root+36+x+(s>7?12:0)),t,u*3,'sine',.018,.01)}   /* shimmering arpeggio */
    if(s%4===2)hat(t,.012,.05);                               /* whisper of a shaker */
  }
}
function sched(){if(!AC)return;if(nextT<AC.currentTime)nextT=AC.currentTime+.05;while(nextT<AC.currentTime+.3){try{playStep(step,nextT)}catch(e){}nextT+=SIXTEENTH;step=(step+1)%(16*SONG.mel.length)}}
function musicOn(){if(!S.mus||!ensureAudio())return;try{if(AC.state==='suspended')AC.resume();if(!musTimer){nextT=AC.currentTime+.15;step=(Math.ceil(step/16)*16)%(16*SONG.mel.length);musTimer=setInterval(sched,70)} /* resume on a bar line */try{delayN.delayTime.value=Math.min(.95,SIXTEENTH*SONG.delay);musBus.gain.value=.34*(SONG.gain||1)}catch(e){}musGain.gain.cancelScheduledValues(AC.currentTime);musGain.gain.setTargetAtTime(1,AC.currentTime,.4)}catch(e){}}
function musicOff(){try{if(AC)musGain.gain.setTargetAtTime(0,AC.currentTime,.2)}catch(e){}if(musTimer){const t=musTimer;musTimer=null;setTimeout(()=>clearInterval(t),700)}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)musicOff();else if(S.mus&&S.name)musicOn()});

/* ---------- effects ---------- */
function burst(x,y,n){if(reduce())return;const cols=['#22d3ee','#60a5fa','#34d399','#fbbf24','#f472b6'];for(let i=0;i<(n||18);i++){const p=document.createElement('div');p.className='p';p.style.left=x+'px';p.style.top=y+'px';p.style.background=cols[i%5];const a=Math.random()*6.28,d=40+Math.random()*90;p.style.setProperty('--dx',Math.cos(a)*d+'px');p.style.setProperty('--dy',Math.sin(a)*d-30+'px');p.style.setProperty('--r',Math.random()*720+'deg');document.body.appendChild(p);setTimeout(()=>p.remove(),1000)}}
function rain(){if(reduce())return;for(let i=0;i<40;i++)setTimeout(()=>burst(Math.random()*innerWidth,-10,3),i*30)}
function fly(t,x,y){const d=document.createElement('div');d.className='float';d.textContent=t;d.style.left=(x-24)+'px';d.style.top=(y-10)+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),1200)}
function flash(k){const f=$('#flash');f.className='';void f.offsetWidth;f.className=k}
function vib(n){try{navigator.vibrate&&navigator.vibrate(n)}catch(e){}}
function toast(html,ms){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.innerHTML=html;document.body.appendChild(t);setTimeout(()=>t.remove(),ms||3000)}

/* ---------- animated background ---------- */
(function bg(){
  const cv=$('#bg');if(LK&&LK.bg){LK.bg(cv);return}
  const cx=cv.getContext&&cv.getContext('2d');if(!cx)return;
  let W=0,H=0,dpr=1,N=[],P=[],last=0,raf=0;
  function size(){dpr=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);const n=Math.max(22,Math.min(60,Math.round(W*H/26000)));N=[];for(let i=0;i<n;i++)N.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22})}
  const col=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--net').trim()||'34,211,238';return v};
  function draw(t){
    raf=requestAnimationFrame(draw);if(t-last<33)return;last=t;
    const c=col(),dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);
    cx.clearRect(0,0,W,H);
    const g=cx.createRadialGradient(W*.15+Math.sin(t/9000)*60,-40,0,W*.15,-40,Math.max(W,H)*.8);g.addColorStop(0,'rgba('+c+','+(dark?.16:.12)+')');g.addColorStop(1,'rgba('+c+',0)');cx.fillStyle=g;cx.fillRect(0,0,W,H);
    const g2=cx.createRadialGradient(W*.95,H*.9+Math.cos(t/11000)*50,0,W*.95,H*.9,Math.max(W,H)*.6);g2.addColorStop(0,'rgba(37,99,235,'+(dark?.14:.08)+')');g2.addColorStop(1,'rgba(37,99,235,0)');cx.fillStyle=g2;cx.fillRect(0,0,W,H);
    const L=Math.min(150,Math.max(100,W/8));
    for(const a of N){a.x+=a.vx;a.y+=a.vy;if(a.x<-10)a.x=W+10;else if(a.x>W+10)a.x=-10;if(a.y<-10)a.y=H+10;else if(a.y>H+10)a.y=-10}
    cx.lineWidth=1;
    for(let i=0;i<N.length;i++){const a=N[i];for(let j=i+1;j<N.length;j++){const b=N[j],dx=a.x-b.x,dy=a.y-b.y,d=dx*dx+dy*dy;if(d<L*L){const al=(1-Math.sqrt(d)/L)*(dark?.4:.3);cx.strokeStyle='rgba('+c+','+al+')';cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke();
      if(Math.random()<.0009&&P.length<14)P.push({a,b,p:0,s:.012+Math.random()*.01})}}
      cx.fillStyle='rgba('+c+','+(dark?.7:.5)+')';cx.beginPath();cx.arc(a.x,a.y,1.8,0,6.283);cx.fill()}
    for(let i=P.length-1;i>=0;i--){const q=P[i];q.p+=q.s;if(q.p>=1){P.splice(i,1);continue}const x=q.a.x+(q.b.x-q.a.x)*q.p,y=q.a.y+(q.b.y-q.a.y)*q.p;cx.fillStyle='rgba('+c+',.95)';cx.shadowColor='rgba('+c+',1)';cx.shadowBlur=10;cx.beginPath();cx.arc(x,y,2.6,0,6.283);cx.fill();cx.shadowBlur=0}
  }
  size();addEventListener('resize',()=>{size()});
  if(reduce()){draw(1000);cancelAnimationFrame(raf)}else raf=requestAnimationFrame(draw);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!reduce())raf=requestAnimationFrame(draw)});
})();

/* ---------- global leaderboard (via window.CSQ_DB, set by boot.js) + score codes (works in any downloaded copy) ---------- */
let DB=null,UID=null,BOARD=null,BOARDERR='',WRITEERR='',lastPushed='',pushT=0,pushing=false,boardWait=true;
(async function initDb(){
  try{const cl=window.CSQ_DB;if(!cl||!cl.use){boardWait=false;return}
    const [d,u]=await Promise.all([cl.use('db'),cl.use('user')]);DB=d;
    if(u&&u.id)UID=await u.id();
    if(DB&&UID){
      const to=setTimeout(()=>{if(BOARD===null){boardWait=false;BOARDERR='The shared board did not answer in time.';if(V==='ranks')render()}},10000);
      DB.collection('scores').limit(200).onSnapshot(snap=>{clearTimeout(to);boardWait=false;BOARDERR='';BOARD=snap.docs.map(x=>cleanRow(x.id,x.data())).filter(Boolean);{const mine=BOARD.find(r=>r.id===UID);if(mine&&(!S.name||mine.n===S.name)&&(mine.xp>S.xp||mine.best>S.bestTest||mine.bq>S.bestQuiz)){if(!S.name){S.name=mine.n;const g=$('#gate');if(g&&g.classList.contains('on')){g.classList.remove('on');S.skip=0;const m=$('#me');if(m&&(!document.activeElement||document.activeElement===document.body||g.contains(document.activeElement)))m.focus()}}S.xp=Math.max(S.xp,mine.xp);S.bestTest=Math.max(S.bestTest,mine.best);S.bestQuiz=Math.max(S.bestQuiz,mine.bq);save();hud();if(V==='home')render()}}if(V==='ranks')render()},e=>{clearTimeout(to);boardWait=false;BOARDERR=(e&&e.message)||'The shared board is unavailable.';if(V==='ranks')render()});
      pushScore();
    }else boardWait=false;
  }catch(e){boardWait=false}
})();
function cleanRow(id,d){if(!d||typeof d!=='object')return null;const n=typeof d.n==='string'&&/^[A-Z0-9]{3}$/.test(d.n)&&!BAD.includes(d.n)?d.n:null;if(!n)return null;const num=(v,max)=>{v=Math.floor(+v);return Number.isFinite(v)&&v>=0?Math.min(v,max):0};return{id:String(id).slice(0,128),n,xp:num(d.xp,1e7),lv:num(d.lv,1e5),best:num(d.best,100),bq:num(d.bq,100)}}
const taken=n=>!!(BOARD&&BOARD.some(r=>r.n===n&&r.id!==UID));
function payload(){return{n:S.name,xp:S.xp,lv:lvl(),best:S.bestTest|0,bq:S.bestQuiz|0,t:Date.now()}}
function pushScore(){
  if(!DB||!UID||!/^[A-Z0-9]{3}$/.test(S.name))return;clearTimeout(pushT);if(BOARD===null&&boardWait){pushT=setTimeout(pushScore,1500);return}
  pushT=setTimeout(async()=>{
    const p=payload(),key=[p.n,p.xp,p.best,p.bq].join('|');if(key===lastPushed||pushing)return;pushing=true;
    try{await DB.collection('scores').doc(UID).set(p);lastPushed=key;WRITEERR=''}catch(e){WRITEERR=(e&&e.code==='not_granted')?'read-only':'failed';if(e&&e.code==='taken'){WRITEERR='';toast(esc(S.name)+' is already taken. Pick another callsign.',3500);gate(true)}}
    pushing=false;if(V==='ranks')render();
  },1200);
}
const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h.toString(36).toUpperCase().padStart(4,'0').slice(-4)};
/* a downloaded copy hands its score to the online board through the link's #hash (letters, digits, hyphens only) */
function takeXfer(){try{const m=String(location.hash||'').match(/^#sync-([A-Z0-9]{3})-(\d{1,7})-(\d{1,3})-(\d{1,3})-([0-9A-Z]{4})$/);if(!m)return;
  const b=[XP,m[1],m[2],m[3],m[4]];try{history.replaceState(null,'',location.pathname+location.search)}catch(e){location.hash=''}
  if(hash(b.join('-'))!==m[5]||BAD.includes(m[1]))return;
  if(!S.name&&!taken(m[1])){S.name=m[1];S.skip=0}
  if(S.name===m[1]){S.xp=Math.max(S.xp,Math.min(+m[2],1e7));S.bestTest=Math.max(S.bestTest,Math.min(+m[3],100));S.bestQuiz=Math.max(S.bestQuiz,Math.min(+m[4],100));save();setTimeout(()=>toast('✅ Score from your downloaded copy added to the global board',3200),600)}
}catch(e){}}
const BAD=['ASS','SEX','FUK','FUC','DIK','TIT','CUM','KKK','NZI','FAG','NIG','CUN','FCK','WTF'];

/* ---------- name gate (mandatory 3 characters) ---------- */
function gate(force){
  const g=$('#gate'),has=!!S.name;
  g.innerHTML='<div class="card"><div class="logo" style="display:grid;place-items:center">'+logo(96,1)+'</div><h2 id="gt" style="margin-top:6px">'+(has?'Change your callsign':'Enter your callsign')+'</h2><p class="mut" style="margin:0">Use exactly 3 letters or numbers, for example <b>ABC</b>. It appears on the leaderboard next to your best score, and only one person can use each callsign.</p><input class="nameinp" id="nm" maxlength="3" minlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-label="Your 3 character callsign" value="'+esc(S.name||'')+'" placeholder="ABC"><div class="err" id="nerr" role="alert"></div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn" id="ngo" disabled>'+(has?'Save':'Start the quest')+'</button>'+(has?'<button class="btn g" id="ncx">Cancel</button>':'')+'</div><p class="mut" style="font-size:13px;margin:12px 0 0">Music starts when you continue. Use the 🎵 button any time to mute it.</p></div>'+(has?'':'<button class="skip" id="nskip">Skip for now →</button>');
  g.classList.add('on');
  const inp=$('#nm'),go=$('#ngo');
  const chk=()=>{inp.value=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);go.disabled=inp.value.length!==3;$('#nerr').textContent=''};
  inp.addEventListener('input',chk);chk();setTimeout(()=>inp.focus(),50);
  const done=()=>{const v=inp.value;if(!/^[A-Z0-9]{3}$/.test(v)){$('#nerr').textContent='Use exactly 3 letters or numbers.';return}if(BAD.includes(v)){$('#nerr').textContent='Please pick a different callsign.';return}if(v!==S.name&&taken(v)){$('#nerr').textContent=v+' is already taken on the leaderboard. Try another one.';sfx.bad&&sfx.bad();return}
    S.name=v;S.skip=0;save();g.classList.remove('on');ensureAudio();if(S.mus)musicOn();sfx.ok();pushScore();render()};
  go.onclick=done;inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!go.disabled)done()});
  if(has)$('#ncx').onclick=()=>g.classList.remove('on');else $('#nskip').onclick=()=>{S.skip=1;save();g.classList.remove('on');ensureAudio();if(S.mus)musicOn();render();toast('You can add a callsign any time from the ??? badge at the top',3000)};
}

/* ---------- XP / level up with auto-closing 3 second window ---------- */
const lvq=[];let lvOpen=false,lvTimer=0;
function addXP(n,x,y){const o=lvl();S.xp=Math.min(1e7,S.xp+(n|0));save();if(x!=null)fly('+'+n+' XP',x,y);const nw=lvl();if(nw>o){for(let l=o+1;l<=nw;l++)lvq.push(l);if(!lvOpen)showLv()}pushScore()}
function showLv(){
  const n=lvq.shift();if(!n){lvOpen=false;return}lvOpen=true;sfx.lvl();rain();vib([40,40,80]);
  const e=$('#lv');
  e.innerHTML='<div class="card"><div style="display:grid;place-items:center">'+emblem(n)+'</div><div class="mut" style="font-weight:800;letter-spacing:.1em">LEVEL UP</div><div class="big" id="lvt">Level '+n+'</div><p style="margin:4px 0 0;font-weight:700">'+esc(ttl(n))+'</p><div class="cnt" aria-live="off"><div class="cring" id="cring"><b id="csec">3</b></div><span class="mut" id="clab">Closing in 3 seconds</span></div><button class="btn s" id="lvx">Close now</button></div>';
  e.classList.add('on');const t0=Date.now(),DUR=3000;
  const fin=()=>{clearInterval(lvTimer);e.classList.remove('on');lvOpen=false;if(lvq.length)setTimeout(showLv,250)};
  $('#lvx').onclick=fin;setTimeout(()=>{const b=$('#lvx');b&&b.focus()},30);
  lvTimer=setInterval(()=>{const left=Math.max(0,DUR-(Date.now()-t0)),s=Math.ceil(left/1000);const r=$('#cring'),cs=$('#csec'),cl=$('#clab');if(r)r.style.setProperty('--p',left/DUR*100);if(cs)cs.textContent=s;if(cl)cl.textContent='Closing in '+s+(s===1?' second':' seconds');if(left<=0)fin()},80);
}
addEventListener('keydown',e=>{if(e.key==='Escape'&&lvOpen){const b=$('#lvx');b&&b.click()}});
function chk(){const nw=[];BD.forEach(b=>{if(!S.badges[b[0]]&&b[3]()){S.badges[b[0]]=1;nw.push(b)}});return nw}
function badgeToast(nw){if(nw.length){sfx.lvl();toast('<span style="font-size:26px">'+nw[0][1]+'</span><span><b>Badge unlocked</b><br>'+esc(nw[0][2])+'</span>',3000)}}

/* ---------- HUD ---------- */
const TABS=[['home','🏠','Home'],['study','📖','Study'],['quiz','⚡','Quiz'],['test','🎯','Test'],['ranks','🏆','Ranks']];
let V='home',cur=KEYS[0],multi=['all'],sub='notes',cfg={n:'10',kind:'all',timed:false},R=null,tm=null,fc=null,gq='';
function fig(im){const alt=String(im[1]).replace(/<[^>]*>/g,'').replace(/["&<>]/g,' ').trim();return '<figure>'+String(im[0]).replace('<svg','<svg role="img" aria-label="'+esc(alt)+'"')+'<figcaption>'+esc(im[1])+'</figcaption></figure>'}
const PAL=LK?LK.palettes:[['cyber','Cyber cyan',190],['blue','Ocean blue',218],['violet','Violet',265],['rose','Neon pink',325],['red','Crimson',352],['amber','Amber',36],['green','Emerald',150]];
if(!PAL.some(x=>x[0]===S.acc))S.acc=PAL[0][0];
const isDark=()=>document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&(GUIDE.defaultTheme==='dark'||(!GUIDE.defaultTheme&&matchMedia('(prefers-color-scheme: dark)').matches)));
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return[f(0),f(8),f(4)].map(x=>Math.round(x*255)).join(',')}
const THM_MOON='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>',THM_SUN='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>';
function thmIcon(){const b=$('#thm');if(b)b.innerHTML=isDark()?THM_SUN:THM_MOON}
function accent(){thmIcon();const st=document.documentElement.style,p=PAL.find(x=>x[0]===S.acc)||PAL[0],props=['--bg','--bg2','--card','--cardA','--tx','--mut','--ac','--ac2','--bd','--glow','--net','--bt'];
  if(p===PAL[0]){props.forEach(k=>st.removeProperty(k));setMeta(isDark()?(LK?LK.meta.dark:'#050d18'):(LK?LK.meta.light:'#eaf2fb'));return}
  const h=p[2],h2=(h+28)%360,d=isDark(),v=LK?LK.gen(h,d):d?{'--bg':`hsl(${h} 55% 6%)`,'--bg2':`hsl(${h} 50% 10%)`,'--card':`hsl(${h} 45% 13%)`,'--cardA':`hsl(${h} 45% 13% / .86)`,'--tx':`hsl(${h} 40% 95%)`,'--mut':`hsl(${h} 22% 70%)`,'--ac':`hsl(${h} 92% 70%)`,'--ac2':`hsl(${h2} 92% 74%)`,'--bd':`hsl(${h} 40% 21%)`,'--glow':`hsl(${h} 92% 70% / .3)`,'--net':hsl2rgb(h,92,70),'--bt':'#041321'}
   :{'--bg':`hsl(${h} 55% 95%)`,'--bg2':`hsl(${h} 45% 91%)`,'--card':'#fff','--cardA':'rgba(255,255,255,.88)','--tx':`hsl(${h} 55% 11%)`,'--mut':`hsl(${h} 20% 36%)`,'--ac':`hsl(${h} 85% 26%)`,'--ac2':`hsl(${h2} 80% 27%)`,'--bd':`hsl(${h} 35% 84%)`,'--glow':`hsl(${h} 85% 26% / .25)`,'--net':hsl2rgb(h,85,26),'--bt':'#fff'};
  if(p[0]==='amber'&&!d)v['--ac2']=`hsl(${h2} 80% 21%)`;Object.keys(v).forEach(k=>st.setProperty(k,v[k]));setMeta(v['--bg'])}
function setMeta(c){const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',c)}
function theme(){if(S.theme)document.documentElement.dataset.theme=S.theme;accent()}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',accent)}catch(e){}
function palette(){let p=$('#palpop');const b=$('#pal');if(p){p.remove();b.setAttribute('aria-expanded','false');return}
  p=document.createElement('div');p.id='palpop';p.setAttribute('role','dialog');p.setAttribute('aria-label','Color theme');
  p.innerHTML='<h3>COLOR THEME</h3><div class="sw">'+PAL.map(x=>'<button data-a="'+x[0]+'" aria-pressed="'+(S.acc===x[0])+'" aria-label="'+x[1]+'" title="'+x[1]+'" style="background:'+(LK&&LK.swatch?LK.swatch(x[2]):'linear-gradient(135deg,hsl('+x[2]+' 85% 55%),hsl('+((x[2]+28)%360)+' 85% 62%))')+'"></button>').join('')+'</div>';
  document.body.appendChild(p);b.setAttribute('aria-expanded','true');{const r=b.getBoundingClientRect(),pw=p.offsetWidth,vw=document.documentElement.clientWidth;p.style.top=(r.bottom+8)+'px';p.style.right='auto';p.style.left=Math.max(16,Math.min(vw-pw-16,r.right-pw))+'px'}
  p.querySelectorAll('button').forEach(x=>x.onclick=()=>{S.acc=x.dataset.a;save();accent();sfx.click();p.querySelectorAll('button').forEach(y=>y.setAttribute('aria-pressed',String(y===x)))});
  setTimeout(()=>document.addEventListener('pointerdown',function f(e){if(!p.contains(e.target)&&e.target!==b){p.remove();b.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',f)}}),0);
  document.addEventListener('keydown',function f(e){if(e.key==='Escape'){p.remove();b.setAttribute('aria-expanded','false');b.focus();document.removeEventListener('keydown',f)}})}
function hud(){
  const l=lvl(),inL=S.xp%PER;
  $('#brandlogo').innerHTML=logo(34)+'<span class="w"><b>'+esc(GUIDE.short)+'</b> QUEST</span>';
  $('#me').innerHTML='<span class="nm" style="font-family:var(--fd);letter-spacing:.14em">'+esc(S.name||'???')+'</span> <span class="mut">Lv '+l+'</span>';$('#me').setAttribute('aria-label',(S.name||'???')+' Lv '+l+', change your 3 letter callsign');
  $('#stv').textContent=R?R.streak:0;
  $('#xpbar').firstElementChild.style.width=(inL/PER*100)+'%';
  const m=$('#mus'),s=$('#snd');m.classList.toggle('off',!S.mus);m.classList.toggle('on',!!S.mus);m.setAttribute('aria-pressed',S.mus?'true':'false');s.classList.toggle('off',!S.snd);s.setAttribute('aria-pressed',S.snd?'true':'false');
}
function tabs(){$('#tabs').innerHTML=TABS.map(t=>'<button class="tab '+((V===t[0]||(V==='run'&&R&&R.mode===t[0])||(V==='res'&&R&&R.mode===t[0]))?'on':'')+'" data-v="'+t[0]+'">'+t[1]+' '+t[2]+'</button>').join('');$('#tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{sfx.click();go(b.dataset.v)})}
function chips(){const el=$('#chips');
  if(V==='home'||V==='run'||V==='res'||V==='ranks'){el.style.display='none';return}
  el.style.display='flex';
  const allOk=V!=='study'||sub==='gloss';
  const sel=(V==='study'&&!allOk)?[cur]:(V==='study'?[cur]:multi);
  const items=(allOk?[['all','★','All']]:[]).concat(KEYS.map(k=>[k,k==='E'?'✉':k,esc(chName(k))]));
  el.innerHTML=items.map(it=>{const k=it[0],on=sel.includes(k),p=k==='all'?Math.round(KEYS.reduce((a,c)=>a+prog(c),0)/KEYS.length):prog(k);return '<button class="chip '+(on?'on':'')+'" data-k="'+esc(k)+'" aria-pressed="'+on+'" aria-label="'+(k==='all'?'All chapters':esc(chName(k))+' '+esc(CH[k][0]))+', '+p+' percent"><span class="ring" style="--p:'+p+'"><b data-g="'+esc(it[1])+'"></b></span><small>'+it[2]+'</small></button>'}).join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>{sfx.click();pick(b.dataset.k)})}
function pick(k){if(V==='study'){cur=k;fc=null}else{if(k==='all')multi=['all'];else{multi=multi.filter(x=>x!=='all');multi=multi.includes(k)?multi.filter(x=>x!==k):multi.concat(k);if(!multi.length)multi=['all']}}render()}
function go(v){V=v;if(v!=='run')clearInterval(tm);if(v==='study'&&cur==='all'&&sub!=='gloss')cur=KEYS[0];render();scrollTo({top:0,behavior:reduce()?'auto':'smooth'})}
function render(){tabs();chips();hud();({home,study,quiz:()=>setup('quiz'),test:()=>setup('test'),ranks,run,res}[V]||home)()}
$('#thm').onclick=()=>{const d=isDark();S.theme=d?'light':'dark';theme();save();sfx.click()};
$('#mus').onclick=()=>{S.mus=S.mus?0:1;save();if(S.mus)musicOn();else musicOff();hud();toast(S.mus?'🎵 Music on':'🔇 Music muted',1400)};
$('#snd').onclick=()=>{S.snd=S.snd?0:1;save();hud();if(S.snd)sfx.click()};
$('#me').onclick=()=>gate(!!S.name);$('#pal').onclick=palette;

/* ---------- home ---------- */
function home(){
  const l=lvl(),inL=S.xp%PER,acc=S.ans?Math.round(100*S.cor/S.ans):0,tot=ALLQ.length;
  const top=[...S.hist].sort((a,b)=>b.pct-a.pct||b.n-a.n).slice(0,3);
  main.innerHTML='<div class="page"><div class="card hero"><div class="logo">'+logo(116,1)+'</div><div class="t"><div class="mut" style="font-weight:800;letter-spacing:.1em;font-size:12px">WELCOME BACK, '+esc(S.name||'')+'</div><h1 style="font-size:28px;margin:2px 0">'+esc(ttl())+' · Level '+l+'</h1><div class="bar" style="margin:8px 0"><i style="width:'+(inL/PER*100)+'%"></i></div><div class="mut" style="font-size:14px">'+inL+' / '+PER+' XP to level '+(l+1)+' · '+S.xp+' XP total</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="q10">⚡ Quick 10</button><button class="btn g" id="t30">🎯 Full test</button></div></div></div>'
  +'<div class="stat" style="margin-bottom:14px"><div><b>'+tot+'</b>questions</div><div><b>'+G.length+'</b>glossary terms</div><div><b>'+acc+'%</b>accuracy</div><div><b>'+S.bestTest+'%</b>best test</div></div>'
  +'<h2 style="margin:6px 0 10px">Chapters</h2><div class="grid">'+KEYS.map((k,i)=>{const p=prog(k);return '<div class="card hv" style="animation-delay:'+i*.04+'s"><div style="display:flex;gap:12px;align-items:center"><span class="cico" aria-hidden="true">'+esc(CH[k][1])+'</span><div style="min-width:0"><h3 style="margin:0">'+(GUIDE.extraChapterNames&&GUIDE.extraChapterNames[k]?esc(GUIDE.extraChapterNames[k])+' (class notes)':'Chapter '+esc(k))+'</h3><div class="mut" style="font-size:14px">'+esc(CH[k][0])+'</div></div></div><div class="bar" style="margin:12px 0 8px"><i style="width:'+p+'%"></i></div><div class="mut" style="font-size:13px">'+p+'% mastered · '+POOLN(k)+' questions</div><div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn s g" data-s="'+esc(k)+'">Study</button><button class="btn s" data-q="'+esc(k)+'">Quiz</button></div></div>'}).join('')+'</div>'
  +'<h2 style="margin:6px 0 10px">Badges</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">'+BD.map(b=>'<div class="badge '+(S.badges[b[0]]?'':'off')+'"><span aria-hidden="true">'+b[1]+'</span>'+b[2]+'</div>').join('')+'</div>'
  +(top.length?'<div class="card"><h3>Your best runs</h3>'+top.map(h=>'<div style="display:flex;justify-content:space-between;padding:4px 0"><span>'+(h.mode==='test'?'🎯':'⚡')+' '+esc(h.scope)+'</span><b>'+h.pct+'%</b></div>').join('')+'</div>':'')+'</div>';
  $('#q10').onclick=()=>{multi=['all'];cfg.kind='all';cfg.n='10';start('quiz')};$('#t30').onclick=()=>{multi=['all'];cfg.kind='all';cfg.n='40';go('test')};
  main.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{cur=b.dataset.s;sub='notes';go('study')});
  main.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{multi=[b.dataset.q];go('quiz')});
}

/* ---------- study ---------- */
const cards=c=>N[c].map((s,i)=>{const j=s.indexOf(' — ');return{k:c+':'+i,t:j>0?s.slice(0,j):'Note',d:j>0?s.slice(j+3):s}});
const gcards=c=>G.map((g,i)=>({k:'g'+i,c:g[0],t:g[1],x:g[2],d:g[3]})).filter(g=>c==='all'||g.c===c);
function study(){
  const sb=[['notes','📖 Notes'],['flash','🃏 Flashcards'],['gloss','🔤 Glossary & acronyms']];
  let h='<div class="page"><div class="tog" role="tablist" aria-label="Study modes">'+sb.map(s=>'<button role="tab" aria-selected="'+(sub===s[0])+'" class="'+(sub===s[0]?'on':'')+'" data-sb="'+s[0]+'">'+s[1]+'</button>').join('')+'</div>';
  if(sub==='notes'){const c=cur,cs=cards(c),kn=cs.filter(x=>S.known[x.k]).length;
    h+='<div class="card"><h2>'+esc(CH[c][1])+' '+(GUIDE.extraChapterNames&&GUIDE.extraChapterNames[c]?esc(GUIDE.extraChapterNames[c])+' (class notes)':'Chapter '+esc(c))+': '+esc(CH[c][0])+'</h2><div class="mut">'+kn+' of '+cs.length+' notes marked as known</div><div class="bar" style="margin-top:8px"><i style="width:'+(100*kn/cs.length)+'%"></i></div></div>';
    const im={'6':'tcp','10':'arp','11':'ch'}[c];if(im&&IMG[im])h+='<div class="card">'+fig(IMG[im])+'</div>';
    h+=cs.map(x=>'<div class="note"><b>'+esc(x.t)+'</b> — '+esc(x.d)+'<div style="margin-top:6px"><button class="btn s '+(S.known[x.k]?'':'g')+'" data-k="'+x.k+'" aria-pressed="'+!!S.known[x.k]+'">'+(S.known[x.k]?'✓ Known':'Mark as known')+'</button></div></div>').join('')}
  else if(sub==='flash'){const c=cur,cs=cards(c).map(x=>({k:x.k,t:x.t,x:'',d:x.d})).concat(gcards(c).map(g=>({k:g.k,t:g.t,x:g.x,d:g.d})));
    if(!fc||fc.c!==c)fc={c,o:shuffle(cs.map((_,i)=>i)),i:0,f:0};
    const x=cs[fc.o[fc.i%cs.length]],kn=cs.filter(y=>S.known[y.k]).length;
    h+='<div class="card"><h2>'+esc(CH[c][1])+' Flashcards</h2><div class="mut">Card '+(fc.i%cs.length+1)+' of '+cs.length+' · '+kn+' known · tap the card to flip</div></div><div class="fc '+(fc.f?'flip':'')+'" id="fcard"><div class="fci"><div class="face" role="button" tabindex="0" aria-label="'+esc(x.t+(x.x?' Acronym?':''))+', flip card"><b>'+esc(x.t)+(x.x?'<br><span class="mut" style="font:500 14px var(--fb)">Acronym?</span>':'')+'</b></div><div class="face back" role="button" tabindex="0" aria-label="'+esc((x.x?x.x+' ':'')+x.d)+', flip card"><div>'+(x.x?'<b>'+esc(x.x)+'</b><br>':'')+'<span>'+esc(x.d)+'</span></div></div></div></div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn g" id="fno">Still learning</button><button class="btn" id="fyes">Got it +2 XP</button></div>'}
  else{const list=gcards(cur).filter(g=>!gq||(g.t+' '+g.x+' '+g.d).toLowerCase().includes(gq.toLowerCase()));
    h+='<div class="card"><h2>Glossary and acronyms</h2><div class="mut">Every term and acronym from your notes, the book chapters and the class documents. '+G.length+' entries.</div><label class="lab" for="gsearch">Search</label><input class="search" id="gsearch" type="search" placeholder="Type a term, acronym or keyword" value="'+esc(gq)+'" autocomplete="off"></div><div class="mut" style="margin:4px 4px 8px">'+list.length+' shown</div>'
    +list.map(g=>'<div class="gl"><b>'+esc(g.t)+'</b>'+(g.x?'<span class="ex">'+esc(g.x)+'</span>':'')+'<span class="tag" style="margin-left:8px">'+esc(chName(g.c))+'</span><div style="margin-top:4px">'+esc(g.d)+'</div></div>').join('')}
  main.innerHTML=h+'</div>';
  main.querySelectorAll('[data-sb]').forEach(b=>b.onclick=()=>{sub=b.dataset.sb;fc=null;if(sub==='gloss')cur='all';else if(cur==='all')cur=KEYS[0];render()});
  main.querySelectorAll('[data-k]').forEach(b=>b.onclick=e=>{const k=b.dataset.k;if(S.known[k])delete S.known[k];else{S.known[k]=1;sfx.ok();addXP(2,e.clientX,e.clientY);badgeToast(chk())}save();render()});
  const gs=$('#gsearch');if(gs)gs.oninput=()=>{gq=gs.value;const p=gs.selectionStart;study();const n=$('#gsearch');n.focus();n.setSelectionRange(p,p)};
  if(sub==='flash'){const fl=()=>{fc.f^=1;$('#fcard').classList.toggle('flip');sfx.click()};main.querySelectorAll('.face').forEach(f=>{f.onclick=fl;f.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fl()}}});
    const cs=cards(fc.c).map(x=>({k:x.k})).concat(gcards(fc.c).map(g=>({k:g.k}))),nx=ok=>{const y=cs[fc.o[fc.i%cs.length]];if(ok&&!S.known[y.k]){S.known[y.k]=1;sfx.ok();addXP(2,innerWidth/2,innerHeight/2);badgeToast(chk())}fc.i++;fc.f=0;save();render()};$('#fno').onclick=()=>nx(false);$('#fyes').onclick=()=>nx(true)}
}

/* ---------- setup ---------- */
const pool=()=>ALLQ.filter(q=>(multi.includes('all')||multi.includes(q.c))&&(cfg.kind==='all'||q.t===cfg.kind));
function setup(m){
  const n=pool().length,isT=m==='test';
  main.innerHTML='<div class="page"><div class="card"><h2>'+(isT?'🎯 Test mode':'⚡ Quiz mode')+'</h2><div class="mut">'+(isT?'Graded. No feedback until the end, then a full review with answers and explanations.':'Instant feedback with a full explanation after every answer. Earn XP and streak bonuses.')+'</div>'
  +'<span class="lab">Chapters (pick in the bar above)</span><div style="margin:4px 0 8px">'+(multi.includes('all')?'<span class="tag">All chapters</span>':multi.map(k=>'<span class="tag">'+esc(chName(k))+' · '+esc(CH[k][0])+'</span>').join(''))+'</div>'
  +'<span class="lab">Question type</span><div class="tog" id="tk">'+[['all','All'],['s','Scenarios'],['d','Definitions'],['a','Acronyms']].map(x=>'<button class="'+(cfg.kind===x[0]?'on':'')+'" data-v="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'
  +'<span class="lab">How many</span><div class="tog" id="tn">'+['10','20','40','all'].map(x=>'<button class="'+(cfg.n===x?'on':'')+'" data-v="'+x+'">'+(x==='all'?'All ('+n+')':x)+'</button>').join('')+'</div>'
  +(isT?'<span class="lab">Timer</span><div class="tog" id="tt"><button class="'+(!cfg.timed?'on':'')+'" data-v="0">Untimed</button><button class="'+(cfg.timed?'on':'')+'" data-v="1">Timed (45 s per question)</button></div>':'')
  +'<div style="margin-top:14px"><button class="btn" id="go" '+(n?'':'disabled')+'>Start '+(isT?'test':'quiz')+' ('+Math.min(n,cfg.n==='all'?n:+cfg.n)+' questions)</button></div>'+(n?'':'<div class="err">No questions match. Change the filters.</div>')+'</div></div>';
  $('#tk').querySelectorAll('button').forEach(b=>b.onclick=()=>{cfg.kind=b.dataset.v;setup(m)});
  $('#tn').querySelectorAll('button').forEach(b=>b.onclick=()=>{cfg.n=b.dataset.v;setup(m)});
  if(isT)$('#tt').querySelectorAll('button').forEach(b=>b.onclick=()=>{cfg.timed=b.dataset.v==='1';setup(m)});
  $('#go').onclick=()=>start(m);
}
function start(m,custom){
  let p=custom||pool();p=shuffle(p);if(!custom&&cfg.n!=='all')p=p.slice(0,+cfg.n);
  if(!p.length)return;
  const qs=p.map(q=>{const ord=shuffle(q.o.map((t,i)=>i));return{q,ord,ci:ord.indexOf(q.a)}});
  R={mode:m,qs,i:0,right:0,ans:[],pick:[],streak:0,mx:0,lock:0,timed:m==='test'&&cfg.timed,tleft:qs.length*45,scope:multi.includes('all')?'All chapters':multi.map(chName).join(', '),sel:null,xp:0};
  V='run';clearInterval(tm);
  if(R.timed)tm=setInterval(()=>{R.tleft--;const t=$('#tleft');if(t){t.textContent=fmt(R.tleft)}if(R.tleft<=0){clearInterval(tm);finish()}},1000);
  render();scrollTo(0,0);
}
const fmt=s=>Math.floor(s/60)+':'+String(Math.max(0,s%60)).padStart(2,'0');

/* ---------- run ---------- */
function run(){
  if(!R)return go('home');if(R.i>=R.qs.length)return finish();
  const x=R.qs[R.i],q=x.q,isT=R.mode==='test',img=q.i&&IMG[q.i];
  main.innerHTML='<div class="page"><div class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span><span class="tag">'+esc(chName(q.c))+'</span><span class="tag">'+KIND[q.t]+'</span>'+(q.src==='doc'?'<span class="tag">Class doc</span>':'')+'</span><span class="mut" style="font-weight:700">'+(R.i+1)+' / '+R.qs.length+(R.timed?' · <span id="tleft">'+fmt(R.tleft)+'</span>':'')+'</span></div><div class="bar" style="margin:8px 0 14px"><i style="width:'+(R.i/R.qs.length*100)+'%"></i></div>'
  +(R.streak>=3&&!isT?'<div style="font-weight:800;color:var(--warn)">🔥 '+R.streak+' in a row</div>':'')
  +'<h3 style="font-size:19px;line-height:1.4;margin-bottom:10px">'+esc(q.q)+'</h3>'+(img?fig(img):'')
  +x.ord.map((oi,k)=>'<button class="opt" data-k="'+k+'" style="animation-delay:'+k*.05+'s"><i>'+'ABCDEF'[k]+'</i><span>'+esc(q.o[oi])+'</span></button>').join('')
  +'<div id="fb"></div><div id="nxt" style="margin-top:12px"></div><div class="mut keyhint">Keyboard: 1–'+x.ord.length+' or A–'+'ABCDEF'[x.ord.length-1]+' to answer · Enter for next</div></div></div>';
  const bs=[...main.querySelectorAll('.opt')];
  bs.forEach(b=>b.onclick=e=>ans(+b.dataset.k,b,e));
  if(isT&&R.sel!=null)mark();
}
function mark(){const bs=[...main.querySelectorAll('.opt')];bs.forEach((b,k)=>b.classList.toggle('sel',k===R.sel));$('#nxt').innerHTML='<button class="btn" id="nb">'+(R.i+1>=R.qs.length?'Finish test':'Next question')+'</button>';$('#nb').onclick=()=>{R.ans.push(R.sel===R.qs[R.i].ci);R.pick.push(R.sel);if(R.sel===R.qs[R.i].ci){R.right++;S.cd[R.qs[R.i].q.k]=R.qs[R.i].q.c}S.ans++;if(R.sel===R.qs[R.i].ci)S.cor++;R.sel=null;R.i++;save();run()}}
function ans(k,el,e){
  if(R.lock)return;const x=R.qs[R.i],q=x.q;
  if(R.mode==='test'){R.sel=k;sfx.click();mark();return}
  R.lock=1;const ok=k===x.ci;R.ans.push(ok);R.pick.push(k);S.ans++;
  const bs=[...main.querySelectorAll('.opt')];bs.forEach(b=>b.disabled=true);
  const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top;
  if(ok){R.right++;S.cor++;S.cd[q.k]=q.c;R.streak++;R.mx=Math.max(R.mx,R.streak);S.best=Math.max(S.best,R.streak);el.classList.add('ok');sfx.ok();flash('g');burst(cx,cy);vib(30);const gain=10+Math.min(R.streak-1,5)*2;R.xp+=gain;addXP(gain,cx,cy)}
  else{R.streak=0;el.classList.add('no');bs[x.ci].classList.add('ok');sfx.bad();flash('r');vib([60,40,60])}
  const nw=chk();hud();save();
  $('#fb').innerHTML='<div class="fb '+(ok?'good':'badc')+'" role="status"><b>'+(ok?['Correct!','Nailed it!','Boom!','Exactly right!'][Math.random()*4|0]:'Not quite. The answer is '+'ABCDEF'[x.ci]+': '+esc(q.o[q.a]))+'</b><div style="margin-top:6px">'+esc(q.e||('Correct answer: '+q.o[q.a]))+'</div></div>';
  $('#nxt').innerHTML='<button class="btn" id="nb">'+(R.i+1>=R.qs.length?'See results':'Next question')+'</button>';$('#nb').onclick=()=>{R.lock=0;R.i++;run()};$('#nb').focus();
  badgeToast(nw);
}

/* ---------- finish + results ---------- */
function finish(){
  clearInterval(tm);if(!R)return go('home');
  while(R.ans.length<R.qs.length){R.ans.push(false);R.pick.push(null)}
  const n=R.qs.length,pct=Math.round(R.right/n*100);R.pct=pct;
  let bonus=Math.round(pct/2)+(pct>=80?25:0)+(R.mode==='test'?R.right*4:0);R.bonus=bonus;
  const prevBest=R.mode==='test'?S.bestTest:S.bestQuiz;R.newBest=pct>prevBest&&n>=5;
  if(R.mode==='test'){if(n>=5)S.bestTest=Math.max(S.bestTest,pct)}else if(n>=5)S.bestQuiz=Math.max(S.bestQuiz,pct);
  S.hist.push({pct,mode:R.mode,scope:R.scope,n,t:Date.now()});S.hist=S.hist.slice(-60);
  R.badges=chk();save();
  V='res';addXP(bonus);pushScore();render();
  if(pct>=80){rain();sfx.lvl()}else if(pct>=50)sfx.ok();else sfx.bad();
  badgeToast(R.badges);
}
function res(){
  const m=R;if(!m)return go('home');
  const miss=m.qs.map((x,i)=>({x,i})).filter(o=>m.ans[o.i]!==true);
  const by={};m.qs.forEach((x,i)=>{const c=x.q.c;by[c]=by[c]||[0,0];by[c][1]++;if(m.ans[i])by[c][0]++});
  main.innerHTML='<div class="page"><div class="card" style="text-align:center"><div class="mut" style="font-weight:800;letter-spacing:.1em">'+(m.mode==='test'?'TEST COMPLETE':'QUIZ COMPLETE')+'</div><div class="big" id="cnt">0%</div><div>'+m.right+' of '+m.qs.length+' correct'+(m.mx>1?' · best streak '+m.mx:'')+'</div><div class="mut">+'+m.bonus+' bonus XP'+(m.newBest?' · 🏅 new personal best!':'')+'</div><div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn" id="again">Go again</button>'+(miss.length?'<button class="btn g" id="retry">Retry missed ('+miss.length+')</button>':'')+'<button class="btn g" id="rk">🏆 Leaderboard</button></div></div>'
  +'<div class="card"><h3>By chapter</h3>'+Object.keys(by).map(c=>'<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>'+esc(CH[c][1])+' '+esc(CH[c][0])+'</span><b>'+by[c][0]+'/'+by[c][1]+'</b></div><div class="bar"><i style="width:'+by[c][0]/by[c][1]*100+'%"></i></div></div>').join('')+'</div>'
  +'<div class="card"><h3>Review '+(miss.length?'missed questions':'')+'</h3>'+(miss.length?miss.map(o=>{const q=o.x.q,pk=m.pick[o.i];return '<div class="note"><b>'+esc(q.q)+'</b><div style="margin-top:6px">Your answer: <span style="color:var(--bad);font-weight:700">'+(pk==null?'(no answer)':esc(q.o[o.x.ord[pk]]))+'</span></div><div>Correct: <span style="color:var(--ok);font-weight:700">'+esc(q.o[q.a])+'</span></div><div class="mut" style="margin-top:4px">'+esc(q.e)+'</div></div>'}).join(''):'<div>Perfect. Nothing to review.</div>')+'</div></div>';
  let v=0;const e=$('#cnt'),t=setInterval(()=>{v+=Math.max(1,Math.round(m.pct/25));if(v>=m.pct){v=m.pct;clearInterval(t)}e.textContent=v+'%'},35);
  $('#again').onclick=()=>go(m.mode);const rt=$('#retry');if(rt)rt.onclick=()=>{start('quiz',miss.map(o=>o.x.q))};$('#rk').onclick=()=>go('ranks');
}

/* ---------- ranks ---------- */
function ranks(){
  const me={n:S.name,xp:S.xp,lv:lvl(),best:S.bestTest|0,me:1};
  let rows=[],src='';
  if(BOARD&&DB){rows=BOARD.map(r=>({n:r.n,xp:r.xp,lv:r.lv,best:r.best,me:r.id===UID}));if(!rows.some(r=>r.me))rows.push(me);src='global'}
  else rows=[me];
  {const by={};rows.forEach(r=>{const k=r.n,o=by[k];if(!o)by[k]=Object.assign({},r);else{o.xp=Math.max(o.xp,r.xp);o.lv=Math.max(o.lv,r.lv);o.best=Math.max(o.best,r.best);o.me=o.me||r.me}});rows=Object.values(by)}
  rows.sort((a,b)=>b.best-a.best||b.xp-a.xp);
  const status=DB&&UID?(boardWait?'Connecting to the shared board…':BOARDERR?esc(BOARDERR):WRITEERR==='read-only'?'You can see the shared board, but this account may not post scores (viewer access). Your scores still count on your own device.':WRITEERR==='failed'?'Your latest score could not be posted. It will retry on your next result.':'Live: everyone who opens this page appears here with their best test score.'):'This downloaded copy cannot reach the shared board by itself. Tap the button below and your score is posted for you.';
  main.innerHTML='<div class="page"><div class="card"><h2>🏆 Leaderboard</h2><div class="mut" style="margin-bottom:8px">'+status+'</div><div class="scroll"><table class="lb"><thead><tr><th>#</th><th>Callsign</th><th>Best test</th><th>Level</th><th>XP</th></tr></thead><tbody>'+rows.slice(0,25).map((r,i)=>'<tr class="'+(r.me?'me':'')+'"><td>'+(i<3?['🥇','🥈','🥉'][i]:i+1)+'</td><td class="nm">'+esc(r.n)+(r.me?' <span class="tag">you</span>':'')+'</td><td>'+r.best+'%</td><td>'+r.lv+'</td><td>'+r.xp+'</td></tr>').join('')+'</tbody></table></div></div>'
  +(!S.name?'<div class="card"><h3>Join the leaderboard</h3><div class="mut" style="margin-bottom:10px">Pick a 3 character callsign (for example ABC) to appear on the global board.</div><button class="btn s" id="setnm">Choose callsign</button></div>':(!(DB&&UID)?'<div class="card"><h3>Global board</h3><div class="mut">The shared board is not connected right now. Reload the page to try again.</div></div>':''))+'<div class="card"><h3>Your history</h3>'+(S.hist.length?[...S.hist].reverse().slice(0,10).map(h=>'<div style="display:flex;justify-content:space-between;padding:4px 0;gap:8px"><span>'+(h.mode==='test'?'🎯':'⚡')+' '+esc(h.scope)+'</span><b>'+h.pct+'%</b></div>').join(''):'<div class="mut">No runs yet. Finish a quiz or test to appear here.</div>')+'</div></div>';
  const sn=$('#setnm');if(sn)sn.onclick=()=>gate(false);
}

/* ---------- keyboard: 1-6 or A-F answers, Enter / Space / → goes on ---------- */
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  if(V!=='run'||!R)return;
  if(document.querySelector('.ov.on')||$('#palpop'))return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  const k=e.key.toLowerCase();let i=-1;
  if(/^[1-6]$/.test(k))i=+k-1;else if(/^[a-f]$/.test(k))i=k.charCodeAt(0)-97;
  if(i>=0){const bs=[...main.querySelectorAll('.opt')];const b=bs[i];if(b&&!b.disabled){e.preventDefault();b.click()}return}
  if(k==='enter'||k===' '||k==='arrowright'){const nb=$('#nb');if(!nb)return;if(t===nb&&k!=='arrowright')return;e.preventDefault();nb.click()}
});

/* ---------- boot ---------- */
theme();hud();render();
takeXfer();addEventListener('hashchange',()=>{takeXfer();pushScore();render()});hud();if(!S.name&&!S.skip)gate(false);else{document.addEventListener('pointerdown',function f(){document.removeEventListener('pointerdown',f);if(S.mus)musicOn()},{once:true})}
})();
