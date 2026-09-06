import { RIVE_ASSET } from './asset-config.js';
export class ExpressiveUI {
  constructor(){
    this.canvas=document.getElementById('mascot-fallback');this.ctx=this.canvas.getContext('2d');this.last=0;this.mood=0;this.progress=0;this.joined=false;
    this.resize=()=>this.rive?.resize();window.addEventListener('resize',this.resize);
    this.visibility=()=>this.rive?.hidden(document.hidden);document.addEventListener('visibilitychange',this.visibility);
    if(RIVE_ASSET.src)this.load();
  }
  async load(){
    try{
      const {createRive}=await import('./rive-driver.js');if(this.disposed)return;
      const canvas=document.getElementById('mascot-rive');
      this.rive=createRive(canvas,RIVE_ASSET,()=>{if(this.disposed)return;this.canvas.hidden=true;canvas.hidden=false;this.rive?.resize();},()=>{this.canvas.hidden=false;canvas.hidden=true;});
    }catch{this.canvas.hidden=false;}
  }
  update(snapshot,self,time){
    this.joined=!!self;this.mood=self?.state.prankLeft>0?2:self?.state.emote?1:snapshot?.puzzle.latched?3:0;
    this.progress=snapshot?(snapshot.sector+(snapshot.puzzle.latched?.5:0))/25:0;
    const celebrate=!!snapshot?.puzzle.latched&&!this.latched;this.latched=!!snapshot?.puzzle.latched;
    this.rive?.update({joined:this.joined,mood:this.mood,progress:this.progress,celebrate});
    if(time-this.last<1/30)return;this.last=time;
    if(this.canvas.hidden)return;
    const c=this.ctx;c.clearRect(0,0,160,160);c.save();c.translate(80,78+Math.sin(time*3)*3);
    c.rotate(this.mood===2?Math.sin(time*18)*.15:Math.sin(time*2)*.04);
    c.fillStyle='#c4d49d';c.strokeStyle='#3b574b';c.lineWidth=4;
    c.beginPath();c.roundRect(-49,-47,98,96,30);c.fill();c.stroke();
    const blink=Math.sin(time*.9)>.996,joy=this.mood===1||this.mood===3;
    for(const x of [-19,19]){c.beginPath();if(joy){c.arc(x,-8,9,Math.PI,Math.PI*2);}else{c.ellipse(x,-8,this.mood===2?7:5,blink?1:this.mood===2?12:8,0,0,Math.PI*2);}c.stroke();}
    c.beginPath();if(this.mood===2)c.ellipse(0,24,9,13,0,0,Math.PI*2);else c.arc(0,13,21,.12,Math.PI-.12);c.stroke();
    c.fillStyle='#dcae94';c.beginPath();c.ellipse(-33,13,8,4,0,0,Math.PI*2);c.ellipse(33,13,8,4,0,0,Math.PI*2);c.fill();
    c.restore();
  }
  dispose(){this.disposed=true;this.rive?.dispose();window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.visibility);}
}
