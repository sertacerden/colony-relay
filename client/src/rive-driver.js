import { Rive, RuntimeLoader, Layout, Fit, Alignment } from '@rive-app/canvas';
import wasmUrl from '@rive-app/canvas/rive.wasm?url';
RuntimeLoader.setWasmUrl(wasmUrl);
export function createRive(canvas,spec,onReady,onFailure){
  let ready=false;
  const instance=new Rive({src:spec.src,canvas,autoplay:true,stateMachines:spec.stateMachine,autoBind:true,
    layout:new Layout({fit:Fit.Contain,alignment:Alignment.Center}),
    onLoad:()=>{ready=true;instance.resizeDrawingSurfaceToCanvas(1);onReady();},onLoadError:()=>{ready=false;onFailure();}});
  return {
    update({joined,mood,progress,celebrate}){
      if(!ready)return;
      const vm=instance.viewModelInstance;
      if(vm){
        const bool=vm.boolean(spec.inputs.joined),emotion=vm.number(spec.inputs.mood),advance=vm.number(spec.inputs.progress);
        if(bool)bool.value=joined;if(emotion)emotion.value=mood;if(advance)advance.value=progress;
        if(celebrate)vm.trigger(spec.inputs.celebrate)?.trigger();
      }else{
        // Existing .riv files can still use their named state machine inputs.
        const inputs=instance.stateMachineInputs(spec.stateMachine);
        for(const input of inputs){if(input.name===spec.inputs.joined)input.value=joined;if(input.name===spec.inputs.mood)input.value=mood;if(input.name===spec.inputs.progress)input.value=progress;if(celebrate&&input.name===spec.inputs.celebrate)input.fire?.();}
      }
    },
    hidden(value){value?instance.stopRendering():instance.startRendering();},
    resize(){instance.resizeDrawingSurfaceToCanvas(1);},
    dispose(){instance.cleanup();}
  };
}
