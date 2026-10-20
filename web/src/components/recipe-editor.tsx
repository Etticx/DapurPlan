"use client";
import { useState } from "react";
import { BookOpen, Coffee, Plus, RotateCcw, Save, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoRecipes, ingredients, unitsFor, perServing, baseQuantity, type Recipe, type IngredientId, type Unit } from "@/lib/recipes";

const selectStyle = "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/10";
export function RecipeEditor() {
  const [recipes, setRecipes] = useState<Recipe[]>(demoRecipes);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState<Recipe>(structuredClone(demoRecipes[0]));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function edit(next:Recipe) {setDraft(next);setDirty(true);setMessage("");setError("");}
  function choose(index:number) {
    if (dirty && !window.confirm("Discard your unsaved recipe changes?")) return;
    setSelected(index);setDraft(structuredClone(recipes[index]));setDirty(false);setMessage("");setError("");
  }
  function updateLine(index:number, patch:Partial<Recipe["lines"][number]>) {edit({...draft,lines:draft.lines.map((line,i)=>i===index?{...line,...patch}:line)});}
  function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(draft.servings) || draft.servings < 1 || draft.servings > 10000 || !draft.lines.length || draft.lines.some(l=>!Number.isFinite(l.quantity)||l.quantity<=0||baseQuantity(l.quantity,l.unit)>1e9||!unitsFor(l.ingredientId).includes(l.unit)) || new Set(draft.lines.map(l=>l.ingredientId)).size !== draft.lines.length) {setError("Use a whole number of servings and positive ingredient quantities. Each ingredient can appear once.");return;}
    setRecipes(recipes.map((r,i)=>i===selected?structuredClone(draft):r));setDirty(false);setError("");setMessage("Recipe applied for this preview. Reloading restores the demo recipes.");
  }
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-500">THE BUILDING BLOCKS OF YOUR PLAN</p><h1 className="text-3xl font-semibold tracking-tight">Your recipes</h1><p className="mt-2 text-sm text-muted-foreground">Tell us what goes into a batch. We’ll work out each serving.</p></div><span className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs text-primary">5 fixed menu items</span></div>
    <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-secondary-foreground"><strong>Demo recipes.</strong> Quantities are examples, not measured restaurant recipes. Edits stay on this page only; database saving comes next.</div>
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <section aria-label="Menu items" className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Menu items</h2><p className="mt-1 text-xs text-muted-foreground">Choose a recipe to review.</p></div><div className="space-y-1 p-2">{recipes.map((r,i)=>{const Icon=r.category==="Food"?UtensilsCrossed:Coffee;return <button key={r.id} type="button" aria-pressed={selected===i} onClick={()=>choose(i)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected===i?"bg-secondary text-primary":"hover:bg-slate-50"}`}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background"><Icon className="size-4" aria-hidden="true" /></span><span><span className="block text-sm font-medium">{r.name}</span><span className="mt-1 block text-xs text-muted-foreground">{r.category} · {r.servings} servings per batch</span></span></button>})}</div><p className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground">Menu names stay fixed to match our forecasting model.</p></section>
      <form onSubmit={save} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6"><div><h2 className="text-xl font-semibold tracking-tight">{draft.name}</h2><p className="mt-1 text-xs text-muted-foreground">Ingredients for one batch</p></div><span className={`rounded-full px-3 py-1 text-xs ${dirty?"bg-amber-50 text-amber-800":"bg-slate-100 text-slate-500"}`}>{dirty?"Unsaved changes":"Demo recipe"}</span></div>
        <div className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-4 rounded-xl bg-background p-4"><BookOpen className="size-5 text-blue-500" aria-hidden="true" /><div className="flex-1"><label htmlFor="batch-servings" className="block text-sm font-medium">How many servings does this batch make?</label><p className="mt-1 text-xs text-muted-foreground">Use your usual pot, tray, or drink batch.</p></div><div className="flex items-center gap-2"><Input id="batch-servings" type="number" min="1" max="10000" step="1" required value={draft.servings || ""} onChange={e=>edit({...draft,servings:Number(e.target.value)})} className="h-11 w-24" /><span className="text-xs text-muted-foreground">servings</span></div></div>
        <div className="mt-6 space-y-3">{draft.lines.map((line,index)=><div key={index} className="grid grid-cols-[minmax(0,1fr)_40px] items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_110px_100px_40px]">
          <div className="min-w-0"><label htmlFor={`ingredient-${index}`} className="mb-1.5 block text-xs text-muted-foreground">Ingredient</label><select id={`ingredient-${index}`} value={line.ingredientId} className={selectStyle} onChange={e=>{const id=e.target.value as IngredientId;updateLine(index,{ingredientId:id,unit:unitsFor(id)[0]});}}>{ingredients.map(i=><option key={i.id} value={i.id} disabled={draft.lines.some((l,n)=>n!==index&&l.ingredientId===i.id)}>{i.name}</option>)}</select></div>
          <div className="col-start-1 sm:col-auto"><label htmlFor={`quantity-${index}`} className="mb-1.5 block text-xs text-muted-foreground">Batch quantity</label><Input id={`quantity-${index}`} className="h-11" type="number" min="0.001" step="0.001" required value={line.quantity || ""} onChange={e=>updateLine(index,{quantity:Number(e.target.value)})} /></div>
          <div className="col-start-1 sm:col-auto"><label htmlFor={`unit-${index}`} className="mb-1.5 block text-xs text-muted-foreground">Unit</label><select id={`unit-${index}`} className={selectStyle} value={line.unit} onChange={e=>{const unit=e.target.value as Unit;updateLine(index,{unit,quantity:baseQuantity(line.quantity,line.unit)/(unit==="kg"||unit==="L"?1000:1)});}}>{unitsFor(line.ingredientId).map(u=><option key={u} value={u}>{u}</option>)}</select></div>
          <button type="button" className="col-start-2 row-start-1 grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-primary sm:col-auto sm:row-auto" aria-label={`Remove ${ingredients.find(i=>i.id===line.ingredientId)!.name}`} onClick={()=>edit({...draft,lines:draft.lines.filter((_,i)=>i!==index)})}><Trash2 className="size-4" aria-hidden="true" /></button>
          <p className="col-span-full text-xs text-muted-foreground">Per serving: <span className="font-medium text-slate-600">{draft.servings>0&&line.quantity>0?perServing(line.quantity,line.unit,draft.servings):"—"}</span></p>
        </div>)}</div>
        <Button type="button" variant="outline" size="sm" className="mt-4" disabled={draft.lines.length===ingredients.length} onClick={()=>{const next=ingredients.find(i=>!draft.lines.some(l=>l.ingredientId===i.id));if(next)edit({...draft,lines:[...draft.lines,{ingredientId:next.id,quantity:1,unit:unitsFor(next.id)[0]}]});}}><Plus aria-hidden="true" />Add ingredient</Button>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Use uncooked or raw quantities. Shared ingredients use one catalogue. Water is included in recipes but excluded from stock tracking.</p>
        {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{message&&<p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        </div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/50 p-5 sm:px-6"><Button type="button" variant="ghost" size="sm" disabled={!dirty} onClick={()=>{setDraft(structuredClone(recipes[selected]));setDirty(false);setError("");setMessage("");}}><RotateCcw aria-hidden="true" />Discard changes</Button><Button type="submit" size="sm" disabled={!dirty}><Save aria-hidden="true" />Apply preview changes</Button></div>
      </form>
    </div>
  </>;
}
