(function(){
  var key="trailco-demo-bag-count",count=0,toast=document.querySelector(".toast"),timer;
  try{count=Math.max(0,Number(localStorage.getItem(key))||0)}catch(_){}
  var nodes=[].slice.call(document.querySelectorAll("[data-cart-count]"));
  function render(){nodes.forEach(function(n){n.textContent=String(count)});try{localStorage.setItem(key,String(count))}catch(_){}}
  function say(message){if(!toast)return;toast.textContent=message;toast.classList.add("is-visible");clearTimeout(timer);timer=setTimeout(function(){toast.classList.remove("is-visible")},2600)}
  render();
  document.querySelectorAll("[data-add]").forEach(function(btn){btn.addEventListener("click",function(){count++;render();var old=btn.textContent.trim();btn.textContent="Added ✓";say("Added to your pack. You have "+count+(count===1?" item.":" items."));setTimeout(function(){btn.textContent=old},1400)})});
  document.querySelectorAll("[data-open-bag]").forEach(function(btn){btn.addEventListener("click",function(){say(count?"Your pack has "+count+(count===1?" item.":" items."):"Your pack is empty for now. Find something for the next trip.")})});
  var menu=document.querySelector(".menu-toggle"),nav=document.querySelector(".site-nav");
  if(menu&&nav){menu.addEventListener("click",function(){var open=nav.classList.toggle("is-open");menu.setAttribute("aria-expanded",String(open));menu.setAttribute("aria-label",open?"Close navigation":"Open navigation");menu.textContent=open?"Close ×":"Menu +"});nav.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){nav.classList.remove("is-open");menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Open navigation");menu.textContent="Menu +"})})}
  var filters=[].slice.call(document.querySelectorAll("[data-filter]")),cards=[].slice.call(document.querySelectorAll("[data-category]"));
  filters.forEach(function(btn){btn.addEventListener("click",function(){var filter=btn.getAttribute("data-filter"),shown=0;filters.forEach(function(f){f.setAttribute("aria-pressed",String(f===btn))});cards.forEach(function(card){var visible=filter==="all"||card.getAttribute("data-category")===filter;card.hidden=!visible;if(visible)shown++});var c=document.querySelector("[data-result-count]");if(c)c.textContent=shown+(shown===1?" piece":" pieces")})});
  document.querySelectorAll("[data-newsletter]").forEach(function(form){form.addEventListener("submit",function(e){e.preventDefault();var input=form.querySelector('input[type="email"]'),message=form.querySelector(".form-message");if(!input||!input.checkValidity()){if(input)input.reportValidity();return}if(message)message.textContent="You're on the list. Keep an eye out for the next field note.";form.reset();say("Thanks for joining Trail Co.")})});
})();