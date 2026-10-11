import {describe,it,expect} from 'vitest';
import {adminCommandSchema,adminQuerySchema} from '../../src/shared/admin';
describe('admin request boundaries',()=>{
 it('requires a valid target and meaningful reason without client authority fields',()=>{
  const action={action:'suspend_member',target:'00000000-0000-4000-8000-000000000001',reason:'Account moderation reason'};
  expect(adminCommandSchema.safeParse(action).success).toBe(true);
  for(const change of [{reason:'short'},{target:'someone'},{actor:action.target},{role:'admin'},{credits:100}])expect(adminCommandSchema.safeParse({...action,...change}).success).toBe(false);
 });
 it('bounds catalogue input and administrative pagination',()=>{
  expect(adminCommandSchema.safeParse({action:'create_skill',slug:'new-skill',name:'New skill',category:'Demo',reason:'Catalogue addition reason'}).success).toBe(true);
  expect(adminCommandSchema.safeParse({action:'create_skill',slug:'../path',name:'New skill',category:'Demo',reason:'Catalogue addition reason'}).success).toBe(false);
  for(const q of [{page:-1},{page:4001},{section:'secrets'},{search:'x'.repeat(101)}])expect(adminQuerySchema.safeParse(q).success).toBe(false);
 });
});
