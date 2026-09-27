import 'server-only';
import {supabaseAdmin} from '@/lib/supabase';
import {managedStoragePath} from '@/lib/request-security';

export async function removeProfilePhoto(userId:string,url:string|null) {
  if(!url)return;
  const path=managedStoragePath(url,'profile-photos',`${userId}/`);
  if(!path)return;
  const {error}=await supabaseAdmin.storage.from('profile-photos').remove([path]);
  if(error)throw Error('photo_cleanup_failed');
}

export async function removeAccountMedia(userId:string) {
  if(!/^[a-f0-9-]{36}$/i.test(userId))throw Error('invalid_media_owner');
  async function removeFolder(bucket:string,prefix:string) {
    const store=supabaseAdmin.storage.from(bucket);
    const files:string[]=[],folders:string[]=[];
    // Gather before deleting, so pagination never skips objects after a removal.
    for(let offset=0;;offset+=100) {
      const {data,error}=await store.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw Error('media_list_failed');
      for(const item of data||[]) {
        if(!item.name || item.name.includes('/') || item.name==='..')throw Error('invalid_media_path');
        (item.id?files:folders).push(`${prefix}/${item.name}`);
      }
      if(!data || data.length<100)break;
    }
    for(const folder of folders)await removeFolder(bucket,folder);
    for(let i=0;i<files.length;i+=100) {
      const {error}=await store.remove(files.slice(i,i+100));
      if(error)throw Error('media_remove_failed');
    }
  }
  // All upload namespaces currently used by profile/gallery and experiment videos.
  const results=await Promise.allSettled([
    removeFolder('profile-photos',userId),removeFolder('raffle-videos',userId),removeFolder('raffle-videos',`profile/${userId}`),
  ]);
  if(results.some(r=>r.status==='rejected'))throw Error('account_media_cleanup_failed');
}
