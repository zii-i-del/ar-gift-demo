import {createRoot} from 'react-dom/client';
import Composition from './Composition';
import ConfettiMaterial from './ConfettiMaterial';
import HeartMotion from './HeartMotion';
import HeartBirth from './HeartBirth';

const view=new URLSearchParams(location.search).get('view');
const Preview=view==='birth'?HeartBirth:view==='stars'?ConfettiMaterial:view==='hearts'?HeartMotion:Composition;
createRoot(document.getElementById('root')!).render(<>
  <nav><a href="?view=composition">三礼物合成</a> · <a href="?view=stars">星星材质</a> · <a href="?view=hearts">爱心运动预览</a> · <a href="?view=birth">爱心出生检查</a></nav>
  <Preview/>
</>);
