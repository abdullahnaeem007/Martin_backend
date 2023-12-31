const express=require('express')
const bodyparser = require('body-parser')
const cors = require('cors')
const PdfParse = require('pdf-parse')
const {RecursiveCharacterTextSplitter} = require('langchain/text_splitter')
const {createClient} = require('@supabase/supabase-js')
const OpenAI = require('openai')
const {config} = require('dotenv')
const { ReadableStream } = require('web-streams-polyfill');
const { time } = require('console')

config()

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const app=express()
app.use(cors())

app.use(
    bodyparser.urlencoded({
      extended: true,
      limit: '50mb',
      parameterLimit: 50000,
    }),
  );
app.use(bodyparser.json({limit: '50mb'}))

app.use(express.json({limit:'50mb'}));
app.use(express.raw({ type: "application/json", limit: "50mb" }));
app.use(express.raw({ type: "application/pdf", limit: "10mb" }));

const PORT=process.env.PORT || 3001
const OpenaiKey=process.env.OPENAI_API_KEY
const url=process.env.SUPABASE_URL
const key=process.env.SUPABASE_KEY
const supabase=createClient(url,key)


app.post('/InputResponse',async (req,res)=>{
    try{
        const Input=req.body.Input
        const result=await GenerateResponseEmbeddings(Input)
        console.log(result)
        res.status(200).json({result:result})
    }
    catch(error)
    {
        console.log(error)
    }
})

async function GenerateResponseEmbeddings(content){
    const response = await fetch('https://api.openai.com/v1/embeddings',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            Authorization:`Bearer ${OpenaiKey}`
        },
        body: JSON.stringify({
            input:content,
            model:'text-embedding-ada-002'
        })
    })   
    const res= await response.json()
    const embedding = res.data[0].embedding

    const {data} = await supabase.rpc('match_documents',{
        query_embedding:embedding,
        similarity_threshold:0.78,
        match_count:10
    })

    
    return data
}

app.post('/GetPDFText',async (req,res)=>{
    const pdfdata=req.body
    const pdfText = await parsePDFText(pdfdata)

    res.status(200).json({text:pdfText})
})


app.post('/pdfParser',async (req,res)=>{
    try{
        const fileText=req.body.fileText
        const name=req.body.name

        let current_percentage=0

        const text_splitter=new RecursiveCharacterTextSplitter({
            chunkSize:1000,
            chunkOverlap:200
        })
        const chunkedDoc=await text_splitter.splitText(fileText)
        let total_percentage=chunkedDoc.length
        for(var i=0;i<chunkedDoc.length;i++)
        {
            current_percentage++
            await GenerateAndStore(chunkedDoc[i],name)
            let percent=(current_percentage/total_percentage)*100
            percent=Math.trunc(percent)
            console.log(percent)
            res.write(percent.toString())
        }
        res.end()
    }
    catch(error)
    {
        console.log(error)
        res.status(500).json({status:'failure'})
    }
})

app.post('/docxParser',async (req,res)=>{
    try{
        const fileText=req.body.fileText
        const name=req.body.name

        let current_percentage=0
        
        var doctext=''
        for (var i=0;i<fileText.length;i++)
        {
            doctext=doctext+fileText[i]
        }
        const text_splitter=new RecursiveCharacterTextSplitter({
            chunkSize:1000,
            chunkOverlap:200
        })
        const chunkedDoc=await text_splitter.splitText(doctext)
        let total_percentage=chunkedDoc.length
        for(var i=0;i<chunkedDoc.length;i++)
        {
            current_percentage++
            await GenerateAndStore(chunkedDoc[i],name)
            let percent=(current_percentage/total_percentage)*100
            percent=Math.trunc(percent)
            console.log(percent)
            res.write(percent.toString())
        }
        res.end()
    }
    catch(error)
    {
        res.status(500).json({status:'failure'})
        console.log(error)
    }
})

app.post('/txtParser',async (req,res)=>{
    try{
        const fileText=req.body.fileText
        const name=req.body.name

        let current_percentage=0

        const text_splitter=new RecursiveCharacterTextSplitter({
            chunkSize:1000,
            chunkOverlap:200
        })
        const chunkedDoc=await text_splitter.splitText(fileText)
        let total_percentage=chunkedDoc.length
        for(var i=0;i<chunkedDoc.length;i++)
        {
            current_percentage++
            await GenerateAndStore(chunkedDoc[i],name)
            let percent=(current_percentage/total_percentage)*100
            percent=Math.trunc(percent)
            console.log(percent)
            res.write(percent.toString())
        }
        res.end()
    }
    catch(error)
    {
        res.status(500).json({status:'failure'})
        console.log(error)
    }
})

async function GenerateAndStore(content,name){
    const response = await fetch('https://api.openai.com/v1/embeddings',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            Authorization:`Bearer ${OpenaiKey}`
        },
        body: JSON.stringify({
            input:content,
            model:'text-embedding-ada-002'
        })
    })   
    const res= await response.json()
    const embedding = res.data[0].embedding
    
    await supabase.from('documents').insert({
        content:content,
        embedding:embedding,
        DocName:name
    })
}

async function parsePDFText(pdfData) {
    try {
        const pdfText = await PdfParse(pdfData);
        return pdfText.text;
    } catch (error) {
        throw error;
    }
}


app.post('/chat',async (req,res)=>{
    const {chatarr}= req.body
    
    const chatCompletion = await openai.chat.completions.create({
      model:"gpt-3.5-turbo",
      messages:chatarr
    })
    res.status(200).json({text:chatCompletion.choices[0].message});
})

app.get('/getHistory',async (req,res)=>{
    const {data,error} = await supabase
    .from('History')
    .select('*')

    res.status(200).json({text:data})
})

app.post('/saveHistory',async (req,res)=>{
    const Item=req.body.item
    const question=Item.Question
    const report=Item.Report

    console.log(Item)

    const {data,error} = await supabase
    .from('History')
    .insert({
        Question:question,
        Report:report
    })

    if(error)
    {
        res.status(500).json({text:'error'})
    }

    res.status(200).json({text:'success'})
})

app.post('/saveDocumentDetails',async (req,res)=>{
    const Item=req.body.item
    const name=Item.name
    const SIZE=Item.size
    const type=Item.type

    console.log(Item)

    const {data,error} = await supabase
    .from('UploadedDocs')
    .insert({
        name:name,
        type:type,
        size:SIZE
    })

    if(error)
    {
        res.status(500).json({text:'error'})
    }

    res.status(200).json({text:'success'})
})

app.get('/getDocumentDetails',async (req,res)=>{
    const {data,error} = await supabase
    .from('UploadedDocs')
    .select('*')

    res.status(200).json({text:data})
})

app.post('/DeleteDocument',async(req,res)=>{
    const name=req.body.name

    const {data,error} = await supabase
    .from('documents')
    .delete()
    .eq('DocName',name)

    const {data2,error2} = await supabase
    .from('UploadedDocs')
    .delete()
    .eq('name',name)

    res.status(200).json({text:data,text2:data2})
})

app.post('/EditDocument',async(req,res)=>{
    const OldName=req.body.OldName
    const NewName=req.body.NewName

    const { data, error } = await supabase
    .from('documents')
    .update({ DocName: NewName })
    .eq('DocName', OldName);

    const { data2, error2 } = await supabase
    .from('UploadedDocs')
    .update({ name: NewName })
    .eq('name', OldName);

    res.status(200).json({text:data,text2:data2})
})

app.post('/DeleteContent',async (req,res)=>{
    const CurrentID = req.body.CurrentID

    const {data,error} = await supabase
    .from('History')
    .delete()
    .eq('id',CurrentID)

    if(error)
    {
        res.status(200).json({text:'error'})
    }

    res.status(200).json({text:'success'})
})


app.listen(PORT,()=>{
    console.log("App is listening on port 3001")
})
