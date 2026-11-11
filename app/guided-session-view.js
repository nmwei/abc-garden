export const escapeGuidedText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Domains supply the content and actions; both routes use the same page structure.
export function guidedHeading({title,subtitle,actions}){
 return `<header class="guided-heading"><div><h1 class="page-title">${escapeGuidedText(title)}</h1><p>${escapeGuidedText(subtitle)}</p></div><div class="guided-header-actions">${actions}</div></header>`;
}

export function guidedStage({classes='',labelledBy,label,position,title,progress,count,steps,phase,body,dock}){
 return `<section class="panel guided-stage ${classes}" ${label?`aria-label="${escapeGuidedText(label)}"`:`aria-labelledby="${labelledBy}"`}${position===undefined?'':` data-guided-position="${escapeGuidedText(position)}"`}>
  <div class="guided-stage-top"><p class="guided-session-progress">${escapeGuidedText(progress)}</p><span class="guided-scope-count">${escapeGuidedText(count)}</span>
   <ol class="guided-stage-path" aria-label="本组学习步骤">${steps.map((step,index)=>`<li ${index===phase?'aria-current="step"':''}><span>${index+1}</span>${escapeGuidedText(step)}</li>`).join('')}</ol>
  </div>
  <h2 id="${labelledBy}" tabindex="-1">${escapeGuidedText(title)}</h2>
  <div class="guided-stage-body">${body}</div>${dock}</section>`;
}

export function guidedStageColumns({visual,instructions}){
 return `<div class="guided-visual">${visual}</div><div class="guided-instructions">${instructions}</div>`;
}

export function guidedDock({kind,status='',statusId,controls}){
 return `<footer class="guided-dock" aria-label="本步操作"><p id="${statusId}" class="guided-audio-status" role="status">${escapeGuidedText(status)}</p><div class="guided-dock-inner guided-dock-${kind}">${controls}</div></footer>`;
}

export function guidedDeferRow({control,noteId,note}){
 return `<div class="guided-defer-row">${control}<span id="${noteId}">${escapeGuidedText(note)}</span></div>`;
}
