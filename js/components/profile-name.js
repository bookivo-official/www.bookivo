(function(B){
 let showing=false;
 B.ensureProfileName=async function(){
  const {data}=await B.supabase.auth.getSession();const user=data?.session?.user;if(!user||showing)return;
  const m=user.user_metadata||{};if(m.username||m.full_name||m.name)return;
  if(!user.identities?.some(i=>i.provider==='google')&&user.app_metadata?.provider!=='google')return;
  const key='bv_name_'+user.id;if(localStorage.getItem(key)){B.AuthStore.set({...B.AuthStore.get(),name:localStorage.getItem(key)});return;}
  showing=true;const dialog=document.createElement('dialog');dialog.className='profile-name-dialog';dialog.innerHTML='<form><button type="button" class="modal-close" aria-label="Close name prompt">×</button><h2>What should we call you?</h2><p>Google did not provide your name. Enter up to 12 characters.</p><label>Your name<input name="name" maxlength="12" required autocomplete="given-name"></label><button class="btn btn-primary" type="submit">Save name</button><p class="fine-print">If you close this, we will use bookivouser.</p></form>';document.body.append(dialog);
  let saving=false;async function save(name){if(saving)return;saving=true;localStorage.setItem(key,name);B.AuthStore.set({...B.AuthStore.get(),name});dialog.close();dialog.remove();showing=false;const {error}=await B.supabase.auth.updateUser({data:{username:name}});B.Toast.show(error?'Name saved on this device. Try again later to sync it.':'Name saved successfully',error?'error':'success');}
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const name=dialog.querySelector('input').value.trim();if(!name)return;save(name.slice(0,12));};dialog.querySelector('.modal-close').onclick=()=>save('bookivouser');dialog.oncancel=e=>{e.preventDefault();save('bookivouser');};dialog.showModal();
 };
})(window.Bookivo);
