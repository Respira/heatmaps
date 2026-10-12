/* Public aggregates only. Never contact payment or CRM providers from here. */
"use strict";
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if(cls) n.className=cls; if(text!==undefined) n.textContent=text; return n; };
const fmt = (v,c) => v===null||v===undefined ? "Unavailable" : new Intl.NumberFormat("en-GB",{style:"currency",currency:c,maximumFractionDigits:v%1?2:0}).format(v);
const money = (values,empty="No paid invoices recorded") => Object.keys(values||{}).length ? Object.entries(values).map(([k,v])=>fmt(v,k)).join(" · ") : empty;
const ledgerMoney = values => values===null||values===undefined ? "Unavailable" : money(values,"No eligible entries");
const date = s => s ? new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}).format(new Date(s))+" UK" : "No successful read";
const period = p => p==="P28D"?"last 28 days":p==="P0D"?"current":p;
const label = {stripe:"Stripe · B2B",therapyapp:"RevenueCat · SuperPenguin",benetalk:"RevenueCat · BeneTalk",campaigns:"Sales engine",milestones:"Company milestones",allowance:"Research allowance"};
const old = r => r.status!=="ok" || !r.last_success_at || Date.now()-Date.parse(r.last_success_at)>150*60000;
const statePill = row => el("span","pill"+(old(row)?" warn":""),old(row)?(row.data?"Last known":"Unavailable"):"Current");
const line = (name,value) => {const n=el("div","secondary");n.append(el("span","",name),el("strong","",value));return n;};
function revenues(data){
  $("revenue").replaceChildren();
  for(const [source,title] of [["stripe","Clinics & teams"],["therapyapp","SuperPenguin app"],["benetalk","BeneTalk app"]]){
    const row=data.sources[source],v=row.data,c=el("article","card"),head=el("div","card-head");head.append(el("h3","",title),statePill(row));c.append(head,el("p","source-label",label[source]));
    if(!v){c.append(el("p","big","—"),el("p","small","This source could not be read. No zero has been substituted."));$("revenue").append(c);continue;}
    c.append(el("p","big",source==="stripe"?money(v.mrr):fmt(v.mrr.value,v.mrr.unit)),el("p","metric-label","Monthly recurring revenue"));
    if(source==="stripe"){
      c.append(line("Annualised ARR",money(v.arr)),line("Paying customers",String(v.paying_customers)),line("Paid seats",String(v.seats)),line("Paid invoices · month to date",money(v.paid_invoices.amounts)),line("Payment receipts · month to date",ledgerMoney(v.cash_collected)),line("Refunds · month to date",ledgerMoney(v.refunds)),line("Payment net after fees",ledgerMoney(v.net_proceeds)),el("p","small",`${v.paid_invoices.count} positive paid invoice(s). Tests and internal activity excluded. ${v.cash_coverage||"Payment ledger is unavailable."}`));
    }else{
      c.append(line("Annualised ARR",fmt(v.arr.value,v.arr.unit)),line("Active subscriptions",String(v.active_subscriptions.value)),line(`Revenue · ${period(v.revenue.period)}`,fmt(v.revenue.value,v.revenue.unit)),line(`New app accounts · ${period(v.new_customers.period)}`,String(v.new_customers.value)),el("p","small",`ARR = MRR × 12. RevenueCat MRR period: ${period(v.mrr.period)}. Revenue is not net proceeds. App accounts are not paying customers.`));
    }
    $("revenue").append(c);
  }
}
function milestones(data){
  $("milestones").replaceChildren();const targets=data.sources.milestones.data?.targets||[];
  for(const v of targets){const c=el("article","milestone"),head=el("div","milestone-title"),a=el("a","",`${v.milestone} · ${v.label} ↗`);a.href=v.url;head.append(a,statePill(data.sources.milestones));c.append(head);
    const b2b=data.sources.stripe.data?.arr?.GBP,t=v.target_arr_gbp["2026"];
    if(v.milestone==="M3"){
      c.append(el("p","value",`${fmt(b2b,"GBP")} ARR`),el("p","small",`End 2026 target: ${fmt(t,"GBP")} ARR`));
      if(b2b!==undefined&&t>0){const bar=el("div","bar"),fill=el("span");fill.style.width=`${Math.min(100,b2b/t*100)}%`;bar.setAttribute("role","img");bar.setAttribute("aria-label",`${(b2b/t*100).toFixed(1)}% of 2026 target`);bar.append(fill);c.append(bar,el("p","small",`${(b2b/t*100).toFixed(1)}% of target · ${fmt(v.target_arr_gbp["2027"],"GBP")} target for 2027`));}
    }else{
      c.append(el("p","value",`${fmt(data.sources.benetalk.data?.arr?.value,"USD")} / ${fmt(data.sources.therapyapp.data?.arr?.value,"USD")}`),el("p","small","BeneTalk / SuperPenguin annualised ARR"),el("p","small",`Combined end 2026 target: ${fmt(t,"GBP")} ARR. Native USD actuals stay separate from GBP targets until a verified conversion is available.`),el("p","small",`End 2027 target: ${fmt(v.target_arr_gbp["2027"],"GBP")} ARR`));
    }$("milestones").append(c);
  }
  if(!targets.length)$("milestones").append(el("p","small","Milestone targets are currently unavailable."));
}
const observed = f => f?.value===null||f?.value===undefined ? "Not connected" : `${f.bound==="lower"?"At least ":""}${new Intl.NumberFormat("en-GB").format(f.value)}${f.coverage==="partial"?" · partial":""}`;
function campaigns(data){const c=data.sources.campaigns.data;$("campaign-head").replaceChildren();$("campaign-body").replaceChildren();$("costs").replaceChildren();if(!c){$("prospects").textContent="Campaign source unavailable";return;}
  $("prospects").textContent=`${c.sourced_prospects_total} sourced prospect records · all time`;
  const head=el("tr");head.append(el("th","","Measure"));for(const w of c.weeks)head.append(el("th","",w.week));$("campaign-head").append(head);
  for(const [k,name] of [["contacts_started","Contacts started"],["sends","Messages sent"],["delivered","Estimated delivered"],["replies_all","Replies"],["positive","Positive replies"],["demos_booked","Demos booked"],["demos_held","Demos attended"],["trials_or_free_signups","Verified signups"],["paying","Attributed new customers"],["website_enquiries","Website enquiries"],["bounces","Recorded bounces"],["unsubscribes","Unsubscribes"],["uncertain_sends","Send outcomes awaiting reconciliation"]]){
    const row=el("tr");row.append(el("th","",name));for(const w of c.weeks){const f=w.counts[k];row.append(el("td",f?.value===null?"unavailable":"",observed(f)));}$("campaign-body").append(row);
  }
  $("campaign-basis").textContent=c.delivery_basis+" "+c.conversion_basis;
  const allowance=data.sources.allowance?.data;if(allowance){$("costs").append(el("span","",`Research allowance: ${allowance.remaining_points===null?"Unknown":allowance.remaining_points.toFixed(1)+" percentage points remaining"} · ${allowance.state} · resets ${date(allowance.reset_at)}`));}const current=c.weeks[0];$("costs").append(el("span","",`Recorded cash cost · ${current.week}: ${current.costs.cash_gbp?.value===null?"Unknown":fmt(current.costs.cash_gbp.value,"GBP")+" ("+current.costs.cash_gbp.coverage+")"}`),el("span","",`Recorded tokens: ${observed(current.costs.tokens_total)}`));
}
function history(points){$("history").replaceChildren();for(const [key,title,unit] of [["b2b_arr_gbp","Clinics & teams ARR","GBP"],["superpenguin_arr_usd","SuperPenguin ARR","USD"],["benetalk_arr_usd","BeneTalk ARR","USD"]]){
  const card=el("article","trend"),values=points.filter(p=>Number.isFinite(p[key]));card.append(el("h3","",title));
  if(values.length<2)card.append(el("p","small","History starts with the first verified snapshot. A trend appears after the next day."));
  else{const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg"),path=document.createElementNS(ns,"polyline");svg.setAttribute("viewBox","0 0 320 90");svg.setAttribute("role","img");svg.setAttribute("aria-label",`${title}, ${fmt(values[0][key],unit)} on ${values[0].date} to ${fmt(values.at(-1)[key],unit)} on ${values.at(-1).date}`);const maximum=Math.max(...values.map(v=>v[key]),1),start=Date.parse(values[0].date),span=Date.parse(values.at(-1).date)-start||1;path.setAttribute("points",values.map(v=>`${10+300*(Date.parse(v.date)-start)/span},${78-65*v[key]/maximum}`).join(" "));path.setAttribute("fill","none");path.setAttribute("stroke","#6550cf");path.setAttribute("stroke-width","3");svg.append(path);card.append(svg,el("p","small",`${values[0].date} → ${values.at(-1).date} · ${fmt(values.at(-1)[key],unit)} latest`));}
  $("history").append(card);
}}
function coverage(data){$("coverage").replaceChildren();for(const text of ["Unknown figures stay unknown. Partial and lower-bound counts include only the evidence currently captured.","Paid Stripe invoices and posted payment/refund entries have separate dates and definitions. Neither proves receipt in the bank. Net covers the payment/refund entries only.","RevenueCat app figures use the provider’s period and USD reporting. New app accounts and active subscriptions are different from distinct paying customers.","Bookings, signups and campaign payment attribution need their own complete sources. Do not use total existing revenue as a campaign conversion count.","The testing-week review will improve this same dashboard from real delivery and customer evidence."])$("coverage").append(el("li","",text));$("sources").replaceChildren();for(const [k,r] of Object.entries(data.sources)){const n=el("div");n.append(el("strong","",label[k]),el("span","",`${old(r)?"Last known · ":"Read · "}${date(r.last_success_at)}`));$("sources").append(n);}}
async function refresh(){const btn=$("refresh");btn.disabled=true;try{const [a,b]=await Promise.all([fetch("sales/data.json",{cache:"no-store"}),fetch("sales/history.json",{cache:"no-store"})]);if(!a.ok||!b.ok)throw Error("Snapshot unavailable");const [data,points]=await Promise.all([a.json(),b.json()]);if(data.schema_version!==1)throw Error("Unsupported snapshot");revenues(data);milestones(data);campaigns(data);history(points);coverage(data);$("updated").textContent=`Snapshot ${date(data.generated_at)}`;const partial=Object.values(data.sources).some(old);$("health").className="pill"+(partial?" warn":"");$("health").textContent=partial?"Some sources need attention":"Sources fetched · coverage below";$("load-error").hidden=true;}catch(e){$("load-error").textContent="The latest snapshot could not be loaded. Any figures already shown are from the previous load. Please try again shortly.";$("load-error").hidden=false;$("health").textContent="Refresh unavailable";$("health").className="pill warn";}finally{btn.disabled=false;}}
$("refresh").addEventListener("click",refresh);refresh();setInterval(refresh,5*60*1000);
