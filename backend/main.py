# main.py

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import re
from typing import Dict
from memory_map import KEY_TERM_MAP  # Import the key-term map

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000",  # React app runs on this origin
    # Add other origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allow specified origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the request body
class Message(BaseModel):
    message: str

def extract_key_terms(message: str, key_map: Dict[str, Dict]) -> Dict[str, Dict]:
    """
    Extracts key terms from the message based on the key_map.
    Returns a dictionary of matched key terms with their definitions and relevance.
    """
    matched_terms = {}
    for key in key_map:
        # Use word boundaries to match whole words, case-insensitive
        pattern = r'\b' + re.escape(key) + r'\b'
        if re.search(pattern, message, re.IGNORECASE):
            matched_terms[key] = key_map[key]
    return matched_terms

def construct_memory_section(matched_terms: Dict[str, Dict]) -> str:
    """
    Constructs the memory section of the prompt based on matched terms.
    """
    if not matched_terms:
        return ""
    
    memory_contents = "\n".join(
        [f"{term}: {details['definition']} (Relevance: {details['relevance']})" 
         for term, details in matched_terms.items()]
    )
    memory_section = f"Memory:\n{memory_contents}\n"
    return memory_section

@app.post("/chat")
async def chat(message: Message):
    try:
        user_message = message.message
        # Extract key terms from the user message
        matched_terms = extract_key_terms(user_message, KEY_TERM_MAP)
        # Construct the memory section
        memory_section = construct_memory_section(matched_terms)
        
        # Compose the full prompt with memory
        prompt_messages = [
            {"role": "system", "content": "You are a helpful assistant."}
        ]
        
        if memory_section:
            prompt_messages.append({"role": "system", "content": memory_section})
        
        prompt_messages.append({"role": "user", "content": user_message})
        
        response = openai.ChatCompletion.create(
            model="gpt-4",  # Corrected model name
            messages=prompt_messages,
            max_tokens=150,
            n=1,
            stop=None,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
