'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const rnd=(a,b)=>a+Math.random()*(b-a);
function show(id){$$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));}

class MockSocket{
  constructor(){ this.h={};this.connected=false;this.room=null; setTimeout(()=>{this.connected=true;this._fire('connect');},500); }
  on(e,f){(this.h[e]=this.h[e]||[]).push(f);return this;}
  _fire(e,d){(this.h[e]||[]).forEach(f=>f(d));}
  _push(e,d){setTimeout(()=>this._fire(e,d),50+Math.random()*80);}
  emit(e,d,cb){setTimeout(()=>this._server(e,d||{},cb?(r=>setTimeout(()=>cb(r),60)):null),70+Math.random()*110);}
  _pub(){return {code:this.room.code,players:this.room.players.map(p=>({...p}))};}
  _later(ms,fn){const room=this.room;const id=setTimeout(()=>{if(this.room===room)fn();},ms);room.timers.push(id);}
  _cleanup(){if(this.room){this.room.timers.forEach(clearTimeout);clearTimeout(this.room.cd);this.room=null;}}
  _code(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[(Math.random()*c.length)|0];return s;}
  _botName(){return ['ShadowHunter','CursedKnight','CrimsonFang','NightSorcerer','VoidWalker'][(Math.random()*5)|0];}
  _bot(){return this.room.players.find(p=>p.id==='bot');}
  _server(e,d,cb){
    switch(e){
      case 'create_room':{
        this._cleanup();
        this.room={code:this._code(),players:[{id:'me',name:d.name,ready:false,host:true}],timers:[],cd:null,counting:false};
        cb&&cb({ok:true,room:this._pub()});
        this._later(2500,()=>{ const n=this._botName(); this.room.players.push({id:'bot',name:n,ready:false,host:false}); this._push('room_update',{room:this._pub()}); this._push('system',{text:n+' joined the room.'}); this._later(900,()=>this._push('chat',{id:'bot',name:n,text:'Took you long enough. Ready to lose? 😈'})); this._later(2400,()=>this._setReady('bot',true)); });
        break;}
      case 'join_room':{
        const code=String(d.code||'').toUpperCase();
        if(!/^[A-Z0-9]{6}$/.test(code)){cb&&cb({ok:false,error:'Room code must be 6 letters/numbers.'});break;}
        if(/^(.)\1{5}$/.test(code)){cb&&cb({ok:false,error:'Room not found.'});break;}
        this._cleanup();
        const n=this._botName();
        this.room={code,players:[{id:'bot',name:n,ready:false,host:true},{id:'me',name:d.name,ready:false,host:false}],timers:[],cd:null,counting:false};
        cb&&cb({ok:true,room:this._pub()});
        this._later(900,()=>this._push('chat',{id:'bot',name:n,text:'Welcome. Hit ready when you want to die.'}));
        this._later(2200,()=>this._setReady('bot',true));
        break;}
      case 'ready':this.room&&this._setReady('me',!!d.ready);break;
      case 'chat':{
        if(!this.room)break;
        this._push('chat',{id:'me',name:d.name,text:String(d.text).slice(0,120)});
        const b=this._bot();
        if(b&&Math.random()<.6)this._later(1200,()=>this._push('chat',{id:'bot',name:b.name,text:['GG in advance.','Domain is charged. Don\'t blink.','Talk is cheap.','Let\'s go!'][(Math.random()*4)|0]}));
        break;}
      case 'leave_room':this._cleanup();break;
    }
  }
  _setReady(id,v){
    const r=this.room;if(!r)return;
    const p=r.players.find(x=>x.id===id);if(!p)return;
    p.ready=v;this._push('room_update',{room:this._pub()});
    const all=r.players.length===2&&r.players.every(x=>x.ready);
    if(all&&!r.counting){
      r.counting=true;let n=3;
      const tick=()=>{
        if(this.room!==r||!r.counting)return;
        this._push('countdown',{n});
        if(n===0){setTimeout(()=>{if(this.room===r)this._push('match_start',{room:this._pub()});},700);return;}
        n--;r.cd=setTimeout(tick,1000);
      };
      tick();
    }else if(!all&&r.counting){
      r.counting=false;clearTimeout(r.cd);this._push('countdown_cancel',{});
    }
  }
}

let sock=null,room=null;
const myName=()=>($('#in-name').value.trim()||'Fighter').slice(0,14);
function connectSock(){
  if(sock)return;
  sock=new MockSocket();
  sock.on('connect',()=>{const n=$('#net');n.textContent='● CONNECTED · '+(30+(Math.random()*40|0))+'ms';n.classList.add('ok');});
  sock.on('room_update',d=>{room=d.room;renderRoom();});
  sock.on('chat',m=>addChat(m.name,m.text,m.id==='me'));
  sock.on('system',m=>addChat(null,m.text));
  sock.on('countdown',d=>{$('#cdown').textContent=d.n>0?'MATCH STARTS IN '+d.n:'FIGHT!';});
  sock.on('countdown_cancel',()=>{$('#cdown').textContent='';});
  sock.on('match_start',()=>{
    const me=room.players.find(p=>p.id==='me'),op=room.players.find(p=>p.id!=='me');
    startMatch('online',{me:me.name,opp:op.name,code:room.code});
  });
}
function lobbyHome(){ $('#lob-home').hidden=false;$('#lob-room').hidden=true;$('#lob-err').textContent='';room=null; }
function enterRoom(){
  $('#lob-home').hidden=true;$('#lob-room').hidden=false;
  $('#chatlog').innerHTML='';$('#cdown').textContent='';
  addChat(null,'Room ready. Share the code with a friend.');
  renderRoom();
}
function renderRoom(){
  if(!room)return;
  $('#rc').textContent=room.code;
  for(let i=0;i<2;i++){
    const el=$('#slot'+i),p=room.players[i];
    if(!p){el.className='slot empty';el.innerHTML='<div class="n">—</div><div class="t">WAITING FOR OPPONENT…</div>';continue;}
    el.className='slot'+(p.ready?' ready':'');
    el.innerHTML='';
    const n=document.createElement('div');n.className='n';n.textContent=p.name+(p.id==='me'?' (YOU)':'');
    const t=document.createElement('div');t.className='t';t.textContent=(p.host?'HOST · ':'')+(p.ready?'READY':'NOT READY');
    el.append(n,t);
  }
  const me=room.players.find(p=>p.id==='me');
  $('#btn-ready').textContent=me&&me.ready?'Cancel Ready':'Ready';
}
function addChat(name,text,mine){
  const log=$('#chatlog'),d=document.createElement('div');
  if(name===null){d.className='sys';d.textContent=text;}
  else{const b=document.createElement('b');if(mine)b.className='me';b.textContent=name+': ';d.append(b,document.createTextNode(text));}
  log.appendChild(d);log.scrollTop=log.scrollHeight;
}
$('#m-off').onclick=()=>startMatch('offline');
$('#m-on').onclick=()=>{show('lobby');connectSock();lobbyHome();};
$('#lob-back').onclick=()=>{if(sock&&room)sock.emit('leave_room');lobbyHome();show('menu');};
$('#btn-create').onclick=()=>{ if(!sock.connected){$('#lob-err').textContent='Still connecting…';return;} $('#lob-err').textContent=''; sock.emit('create_room',{name:myName()},r=>{room=r.room;enterRoom();}); };
$('#btn-join').onclick=()=>{ if(!sock.connected){$('#lob-err').textContent='Still connecting…';return;} const code=$('#in-code').value.trim().toUpperCase(); sock.emit('join_room',{name:myName(),code},r=>{ if(!r.ok){$('#lob-err').textContent=r.error;return;} room=r.room;enterRoom(); }); };
$('#in-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
$('#btn-ready').onclick=()=>{const me=room&&room.players.find(p=>p.id==='me');if(me)sock.emit('ready',{ready:!me.ready});};
$('#btn-leave').onclick=()=>{sock.emit('leave_room');lobbyHome();};
$('#btn-copy').onclick=()=>{try{navigator.clipboard.writeText(room.code);$('#btn-copy').textContent='Copied';setTimeout(()=>$('#btn-copy').textContent='Copy',1200);}catch(e){}};
function sendChat(){const i=$('#in-chat'),t=i.value.trim();if(!t)return;sock.emit('chat',{name:myName(),text:t});i.value='';}
$('#btn-send').onclick=sendChat;
$('#in-chat').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
