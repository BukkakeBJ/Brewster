import express from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {db} from './db';
import {recipeSchema} from '../src/validation';
import {predict} from '../src/engine/calculations';
import {catalog} from '../src/catalog';
const app=express();app.use(express.json({limit:'2mb'}));
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.get('/api/recipes',(_req,res)=>res.json(db.prepare('SELECT document FROM recipes ORDER BY updated_at DESC').all().map(r=>JSON.parse(r.document as string))));
app.put('/api/recipes/:id',(req,res)=>{try{const r=recipeSchema.parse(req.body);if(r.id!==req.params.id)throw new Error('Recipe ID mismatch');predict(r,catalog);db.prepare('INSERT INTO recipes(id,name,document,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document=excluded.document,updated_at=excluded.updated_at').run(r.id,r.name,JSON.stringify(r),new Date().toISOString());res.json(r)}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Invalid recipe'})}});
app.delete('/api/recipes/:id',(req,res)=>{db.prepare('DELETE FROM recipes WHERE id=?').run(req.params.id);res.json({ok:true})});
if(existsSync('dist/index.html')){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')))}
app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(400).json({error:err.message})});
app.listen(3001,'127.0.0.1',()=>console.log('Brew Designer API: http://127.0.0.1:3001'));
