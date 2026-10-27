const $=id=>document.getElementById(id);
const cfg=window.BITLAB_CONFIG||{};

const enabled = Boolean(
  cfg.url?.startsWith('https://') &&
  cfg.publishableKey?.startsWith('sb_publishable_')
);

$('syncAvailability').textContent=enabled?'Sambungan Supabase dikonfigurasi. Penyimpanan memerlukan Internet.':'Mod demonstrasi: Supabase belum dikonfigurasi; keputusan hanya berada pada peranti ini.';
const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function connect(){
 if(!enabled)throw Error('Supabase belum ditetapkan. Isikan URL dan publishable key dalam config.js.');
 if(supabase)return supabase;
 // Modul ini dimuat hanya apabila Internet dan konfigurasi ada.
 const lib=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 supabase=lib.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return supabase;
}
$('adminOpen').onclick=()=>{$('adminSection').classList.remove('hidden');$('adminSection').scrollIntoView({behavior:'smooth'});if(!enabled)msg('Mod demonstrasi. Sediakan config.js dan jalankan SQL setup untuk log masuk sebenar.');};
$('adminClose').onclick=()=>{$('adminSection').classList.add('hidden')};
async function requireAdmin(){
 const db=await connect();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error('Log masuk admin diperlukan.');
 const {data,error:roleError}=await db.from('bitlab_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(roleError||!data)throw Error('Akaun ini belum diberikan peranan admin.');
 return user;
}
$('adminSignIn').onclick=async()=>{
 const button=$('adminSignIn');button.disabled=true;msg('Memeriksa akses admin...');
 try{const db=await connect();const {error}=await db.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});if(error)throw error;
 const user=await requireAdmin();adminAuthenticated=true;$('adminContent').classList.remove('hidden');$('adminLogin').classList.add('hidden');$('adminWelcome').textContent='Admin: '+(user.email||'');$('adminPassword').value='';msg('Log masuk berjaya.');await refresh();}
 catch(e){adminAuthenticated=false;msg('Tidak dapat log masuk: '+e.message)}finally{button.disabled=false}
};
$('adminLogout').onclick=async()=>{try{const db=await connect();await db.auth.signOut()}catch{}adminAuthenticated=false;adminRows=[];$('adminContent').classList.add('hidden');$('adminLogin').classList.remove('hidden');msg('Anda telah log keluar.')};
async function refresh(){
 if(!adminAuthenticated)return;
 msg('Memuatkan rekod...');
 try{await requireAdmin();const db=await connect();
 // Keselamatan akses sebenar dilaksanakan pada RLS Supabase, bukan hanya paparan ini.
 const {data,error}=await db.from('bitlab_attempts').select('id,created_at,student_name,class_name,stage,score,total,attempt_no,passed,alerts,completed').order('created_at',{ascending:false}).limit(1000);
 if(error)throw error;adminRows=data||[];renderFilters();renderTable();msg(`Memaparkan ${adminRows.length} rekod terkini (maksimum 1000).`);
 }catch(e){msg('Gagal membaca rekod: '+e.message)}
}
$('adminRefresh').onclick=refresh;
function renderFilters(){const sel=$('adminClassFilter'),previous=sel.value, classes=[...new Set(adminRows.map(r=>r.class_name||'').filter(Boolean))].sort();sel.replaceChildren(new Option('Semua kelas',''),...classes.map(x=>new Option(x,x)));sel.value=classes.includes(previous)?previous:''}
function rowsVisible(){const q=$('adminSearch').value.trim().toLocaleLowerCase(),cl=$('adminClassFilter').value,status=$('adminStatusFilter').value;return adminRows.filter(r=>(!q||`${r.student_name} ${r.class_name}`.toLocaleLowerCase().includes(q))&&(!cl||r.class_name===cl)&&(!status||(status==='MASTERI'?r.completed:!r.passed)))}
function renderTable(){const rows=rowsVisible(),uniq=new Set(rows.map(r=>`${r.student_name.trim().toLowerCase()}|${(r.class_name||'').trim().toLowerCase()}`));
 $('kSessions').textContent=rows.length;$('kStudents').textContent=uniq.size;$('kMastered').textContent=rows.filter(r=>r.completed).length;$('kNeeds').textContent=rows.filter(r=>!r.passed).length;
 const wrap=$('adminTable');const table=document.createElement('table');table.className='dataTable';table.innerHTML='<thead><tr><th>Tarikh</th><th>Nama</th><th>Kelas</th><th>Tahap</th><th>Skor</th><th>Cubaan</th><th>Status</th><th>Amaran</th></tr></thead>';const body=document.createElement('tbody');
 if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=8;td.textContent='Tiada rekod untuk penapis ini.';tr.append(td);body.append(tr)}
 rows.forEach(r=>{const tr=document.createElement('tr');[new Date(r.created_at).toLocaleString('ms-MY'),r.student_name,r.class_name||'—',r.stage,`${r.score}/${r.total}`,r.attempt_no,r.completed?'MASTERI 3/3':r.passed?'Lulus tahap':'Intervensi',r.alerts].forEach((v,i)=>{const td=document.createElement('td');td.textContent=String(v);if(i===6)td.className=r.passed?'statusOk':'statusNeeds';tr.append(td)});body.append(tr)});table.append(body);wrap.replaceChildren(table)}
['adminSearch','adminClassFilter','adminStatusFilter'].forEach(id=>$(id).addEventListener(id==='adminSearch'?'input':'change',renderTable));
$('adminCsv').onclick=()=>{if(!adminAuthenticated)return;const data=[['Tarikh','Nama','Kelas','Tahap','Skor','Jumlah','Cubaan','Lulus','Masteri penuh','Amaran'],...rowsVisible().map(r=>[r.created_at,r.student_name,r.class_name,r.stage,r.score,r.total,r.attempt_no,r.passed,r.completed,r.alerts])];const csv='\ufeff'+data.map(row=>row.map(value=>'"'+String(value??'').replace(/^[=+@-]/,x=>"'"+x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='bitlab-admin-rekod.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
let studentOwner=null, queued=[];
window.bitlabStudentSessionStart=()=>{studentOwner=null;queued=[]};
window.bitlabRecordAttempt=(entry)=>{
 if(!$('syncConsent').checked||!enabled){if(entry.completed)$('cloudReceipt').textContent='Keputusan disimpan pada peranti sahaja. Muat turun CSV sebagai bukti.';return;}
 const snapshot={...entry};queued.push(snapshot);
 savedTasks=savedTasks.then(async()=>{
  const db=await connect();
  if(!studentOwner){const {data:{user}}=await db.auth.getUser();if(user?.is_anonymous)studentOwner=user.id;else if(!user){const {data,error}=await db.auth.signInAnonymously();if(error)throw error;studentOwner=data.user.id}else throw Error('Penyemak admin sedang log masuk pada peranti ini. Log keluar admin dahulu untuk menghantar data pelajar.');}
  const {error}=await db.from('bitlab_attempts').insert({student_name:snapshot.name,class_name:snapshot.group||'',stage:snapshot.stage,score:snapshot.score,total:snapshot.total,attempt_no:snapshot.attempt,passed:snapshot.passed,alerts:snapshot.alerts,completed:snapshot.completed});if(error)throw error;
  if(snapshot.completed)$('cloudReceipt').textContent='✅ Keputusan dihantar ke pangkalan data. Rekod adalah laporan kendiri, belum disahkan pensyarah.';
 }).catch(e=>{console.warn('Gagal simpan rekod BitLab',e);if(snapshot.completed)$('cloudReceipt').textContent='⚠️ Keputusan belum berjaya dihantar: '+e.message+'. Sila eksport CSV sebagai sandaran.'});
};
