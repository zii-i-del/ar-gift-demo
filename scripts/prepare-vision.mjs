import {mkdir,copyFile,cp,stat,writeFile,rename} from 'node:fs/promises';
const root=new URL('../public/vision/',import.meta.url);
await mkdir(root,{recursive:true});
await copyFile(new URL('../node_modules/@mediapipe/tasks-vision/vision_bundle.js',import.meta.url),new URL('vision_bundle.js',root));
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/',import.meta.url),new URL('wasm/',root),{recursive:true});
const models={
 'face_landmarker.task':'face_landmarker/face_landmarker/float16/1/face_landmarker.task',
 'hand_landmarker.task':'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
 'hair_segmenter.tflite':'image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite',
 'pose_landmarker_lite.task':'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};
for(const [name,path] of Object.entries(models)){
 const target=new URL(name,root);
 if(await stat(target).then(s=>s.size>0,()=>false))continue;
 const response=await fetch('https://storage.googleapis.com/mediapipe-models/'+path);
 if(!response.ok)throw new Error(`Model download failed: ${name} (${response.status})`);
 const tmp=new URL(name+'.tmp',root);await writeFile(tmp,new Uint8Array(await response.arrayBuffer()));await rename(tmp,target);
 console.log('Prepared '+name);
}
