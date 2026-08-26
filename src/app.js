import { createClient } from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb=createClient(url,key);
let user=null, authMode="login", currentSession=null, timer=null;

const $=id=>document.getElementById(id);
function msg(t){console.log(t)}
function view(id){document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");if(id==="teacher")loadTeacher()}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal").classList.remove("show"));

async function init(){
 const {data}=await sb.auth.getSession(); user=data.session?.user||null; updateAuth();
 sb.auth.onAuthStateChange((_e,s)=>{user=s?.user||null;updateAuth();});
}
function updateAuth(){$("authBtn").textContent=user?"Logout":"Login"; if(user)loadTeacher()}
$("authBtn").onclick=async()=>{if(user){await sb.auth.signOut();}else{$("authModal").classList.add("show")}};
$("toggleAuth").onclick=()=>{authMode=authMode==="login"?"signup":"login";$("authTitle").textContent=authMode==="login"?"Sign in":"Create account";$("authSubmit").textContent=authMode==="login"?"Sign in":"Create account";};
$("authSubmit").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value,role=$("role").value;
 if(!email||password.length<6)return $("authMsg").textContent="Use an email and a password of at least 6 characters.";
 if(authMode==="signup"){
   const {data,error}=await sb.auth.signUp({email,password});
   if(error)return $("authMsg").textContent=error.message;
   if(data.user) await sb.from("profiles").upsert({id:data.user.id,email,role});
   $("authMsg").textContent="Account created. Check your email if confirmation is enabled.";
 }else{
   const {error}=await sb.auth.signInWithPassword({email,password});
   $("authMsg").textContent=error?error.message:"Signed in.";
   if(!error)$("authModal").classList.remove("show");
 }
};

$("createBtn").onclick=()=>{if(!user)return $("authModal").classList.add("show");$("examModal").classList.add("show");if(!$("questions").children.length){addQ();addQ()}};
$("addQ").onclick=()=>addQ();
function addQ(){const d=document.createElement("div");d.className="q";d.innerHTML=`<textarea class="qt" placeholder="Question"></textarea><input class="qa" placeholder="Option A"><input class="qb" placeholder="Option B"><input class="qc" placeholder="Option C"><input class="qd" placeholder="Option D"><select class="correct"><option>A</option><option>B</option><option>C</option><option>D</option></select>`;$("questions").appendChild(d)}
$("publish").onclick=async()=>{
 if(!user)return;
 const qs=[...document.querySelectorAll(".q")].map(x=>({text:x.querySelector(".qt").value,a:x.querySelector(".qa").value,b:x.querySelector(".qb").value,c:x.querySelector(".qc").value,d:x.querySelector(".qd").value,correct:x.querySelector(".correct").value})).filter(q=>q.text);
 if(!qs.length)return alert("Add at least one question.");
 const code=$("examSubject").value.slice(0,3).toUpperCase()+"-"+crypto.randomUUID().slice(0,4).toUpperCase();
 const {data:exam,error}=await sb.from("exams").insert({teacher_id:user.id,title:$("examTitle").value,subject:$("examSubject").value,duration_minutes:+$("examDuration").value,pass_mark:+$("examPass").value,join_code:code,status:"draft"}).select().single();
 if(error)return alert(error.message);
 const rows=qs.map((q,i)=>({exam_id:exam.id,position:i+1,question_text:q.text,option_a:q.a,option_b:q.b,option_c:q.c,option_d:q.d,correct_option:q.correct}));
 const {error:e2}=await sb.from("questions").insert(rows);if(e2)return alert(e2.message);
 await sb.from("exams").update({status:"live"}).eq("id",exam.id);
 $("examModal").classList.remove("show");$("questions").innerHTML="";loadTeacher();alert("Exam published. Code: "+code);
};

async function loadTeacher(){
 if(!user){$("teacherContent").innerHTML=`<div class="card">Sign in as a teacher to create and monitor exams.</div>`;return}
 const {data:profile}=await sb.from("profiles").select("role").eq("id",user.id).single();
 if(profile?.role!=="teacher"){ $("teacherContent").innerHTML=`<div class="card">This account is not a teacher account.</div>`;return}
 const {data:exams,error}=await sb.from("exams").select("*").eq("teacher_id",user.id).order("created_at",{ascending:false});
 if(error)return $("teacherContent").innerHTML=`<div class="card">${error.message}</div>`;
 if(!exams?.length)return $("teacherContent").innerHTML=`<div class="card">No exams yet. Create your first exam.</div>`;
 $("teacherContent").innerHTML=exams.map(e=>`<div class="exam"><p class="eyebrow">${e.subject}</p><h3>${e.title}</h3><p><span class="code">${e.join_code}</span> · ${e.duration_minutes} minutes · ${e.status}</p><button class="primary" data-monitor="${e.id}">Monitor Live</button></div>`).join("");
 document.querySelectorAll("[data-monitor]").forEach(b=>b.onclick=()=>monitor(b.dataset.monitor));
}
async function monitor(examId){
 const {data:exam}=await sb.from("exams").select("*").eq("id",examId).single();
 const {data:sessions}=await sb.from("exam_sessions").select("*").eq("exam_id",examId).order("created_at");
 renderMonitor(exam,sessions||[]);
 const channel=sb.channel("exam-"+examId).on("postgres_changes",{event:"*",schema:"public",table:"exam_sessions",filter:"exam_id=eq."+examId},async()=>{const {data:s}=await sb.from("exam_sessions").select("*").eq("exam_id",examId);renderMonitor(exam,s||[])}).subscribe();
}
function renderMonitor(e,s){
 $("teacherContent").innerHTML=`<div class="exam"><button class="secondary" onclick="loadTeacher()">← Back</button><h2>${e.title}</h2><p>Join code: <span class="code">${e.join_code}</span></p><div class="monitor"><table><thead><tr><th>Student</th><th>Answered</th><th>Status</th><th>Score</th></tr></thead><tbody>${s.length?s.map(x=>`<tr><td>${x.student_name}</td><td>${x.answered_count||0}</td><td><span class="pill">${x.status}</span></td><td>${x.score==null?"—":x.score+"%"}</td></tr>`).join(""):`<tr><td colspan="4">Waiting for students...</td></tr>`}</tbody></table></div></div>`;
}

$("joinBtn").onclick=joinExam;
async function joinExam(){
 const name=$("joinName").value.trim(),code=$("joinCode").value.trim().toUpperCase();if(!name||!code)return alert("Enter your name and exam code.");
 const {data:e,error}=await sb.from("exams").select("*").eq("join_code",code).eq("status","live").single();if(error||!e)return alert("Exam not found or not live.");
 const {data:qs}=await sb.from("questions").select("*").eq("exam_id",e.id).order("position");
 const {data:s,error:se}=await sb.from("exam_sessions").insert({exam_id:e.id,student_user_id:user?.id||null,student_name:name,status:"writing",answered_count:0}).select().single();if(se)return alert(se.message);
 currentSession={exam:e,questions:qs,session:s,answers:{}};renderStudent();
}
function renderStudent(){
 const {exam:e,questions:qs}=currentSession;
 $("studentContent").innerHTML=`<div class="card"><h3>${e.title}<span class="timer" id="timer"></span></h3><div id="studentQs"></div><button class="primary full" id="submitExam">Submit Examination</button></div>`;
 qs.forEach((q,i)=>{const d=document.createElement("div");d.className="student-q";d.innerHTML=`<b>${i+1}. ${q.question_text}</b>${["A","B","C","D"].map(k=>`<label class="answer"><input type="radio" name="q${i}" value="${k}"> ${k}. ${q["option_"+k.toLowerCase()]}</label>`).join("")}`;$("studentQs").appendChild(d)});
 document.querySelectorAll('input[type=radio]').forEach(x=>x.onchange=saveAnswer);$("submitExam").onclick=submitExam;startTimer(e.duration_minutes*60);
}
async function saveAnswer(ev){
 const i=+ev.target.name.slice(1),value=ev.target.value;currentSession.answers[i]=value;
 const q=currentSession.questions[i];
 await sb.from("student_answers").upsert({session_id:currentSession.session.id,question_id:q.id,selected_option:value},{onConflict:"session_id,question_id"});
 const count=Object.keys(currentSession.answers).length;
 currentSession.session.answered_count=count;
 await sb.from("exam_sessions").update({answered_count:count}).eq("id",currentSession.session.id);
}
async function submitExam(){
 const {exam,questions,session,answers}=currentSession;let correct=0;questions.forEach((q,i)=>{if(answers[i]===q.correct_option)correct++});
 const score=Math.round(correct/questions.length*100);
 await sb.from("exam_sessions").update({status:"submitted",score,submitted_at:new Date().toISOString(),answered_count:Object.keys(answers).length}).eq("id",session.id);
 $("studentContent").innerHTML=`<div class="card"><h2>Submitted</h2><p>Your result has been submitted to the host.</p><div class="hero-card"><div class="big">${score}%</div><p>${score>=exam.pass_mark?"Passed":"Below pass mark"}</p></div></div>`;
 clearInterval(timer);
}
function startTimer(seconds){clearInterval(timer);let end=Date.now()+seconds*1000;timer=setInterval(()=>{let left=Math.max(0,end-Date.now()),m=Math.floor(left/60000),s=Math.floor(left/1000)%60;const el=$("timer");if(el)el.textContent=`${m}:${String(s).padStart(2,"0")}`;if(left<=0){clearInterval(timer);submitExam()}},1000)}
init();