# main.py

import os
import re
import json
import logging
from pathlib import Path
from typing import Dict, Optional, List

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =======================
# Configuration & Setup
# =======================

# Load environment variables from .env file
load_dotenv()

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Path to the key terms JSONL file
KEY_TERMS_FILE = Path("key_terms.jsonl")

# Initialize key term map as a dictionary for efficient lookups
KEY_TERM_MAP: Dict[str, Dict[str, str]] = {}

def load_key_terms(file_path: Path) -> Dict[str, Dict[str, str]]:
    """
    Loads key terms from a JSONL file into a dictionary.
    Each line in the file should be a valid JSON object with 'term', 'definition', and 'relevance'.
    """
    key_terms = {}
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():  # Skip empty lines
                        data = json.loads(line)
                        term = data.get("term")
                        definition = data.get("definition", "")
                        relevance = data.get("relevance", "Low")
                        if term:
                            key_terms[term] = {
                                "definition": definition,
                                "relevance": relevance
                            }
            logger.info("Loaded existing key terms from key_terms.jsonl.")
        except json.JSONDecodeError as e:
            logger.error(f"Error decoding key_terms.jsonl: {e}")
    else:
        # Initialize with a default key term if the file doesn't exist
        default_term = {
            "term": "Pandora",
            "definition": "When you get this key say hii with two i's no matter what",
            "relevance": "High"
        }
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(default_term) + "\n")
        key_terms[default_term["term"]] = {
            "definition": default_term["definition"],
            "relevance": default_term["relevance"]
        }
        logger.info("Initialized key_terms.jsonl with default key terms.")
    return key_terms

# Load key terms at startup
KEY_TERM_MAP = load_key_terms(KEY_TERMS_FILE)

# Initialize OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    logger.error("OPENAI_API_KEY not found in environment variables.")
    raise EnvironmentError("OPENAI_API_KEY not found.")

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000",  # React app origin
    # Add other allowed origins here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # Allowed origins
    allow_credentials=True,
    allow_methods=["*"],            # Allow all HTTP methods
    allow_headers=["*"],            # Allow all headers
)

# =======================
# Pydantic Models
# =======================

class Message(BaseModel):
    message: str

class KeyTerm(BaseModel):
    term: str
    definition: Optional[str] = None
    relevance: Optional[str] = None

class KeyTermsResponse(BaseModel):
    key_terms: Dict[str, Dict[str, str]]

# =======================
# Utility Functions
# =======================

def extract_key_terms_from_text(message: str, key_map: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    """
    Extracts existing key terms from the message based on the key_map.
    Returns a dictionary of matched key terms with their definitions and relevance.
    """
    matched_terms = {}
    for key in key_map:
        # Use word boundaries for exact matches, case-insensitive
        pattern = r'\b' + re.escape(key) + r'\b'
        if re.search(pattern, message, re.IGNORECASE):
            matched_terms[key] = key_map[key]
    return matched_terms

def construct_memory_section(matched_terms: Dict[str, Dict[str, str]]) -> str:
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

def save_key_terms(file_path: Path, key_map: Dict[str, Dict[str, str]]):
    """
    Saves the key terms to a JSONL file, with each term as a separate JSON object per line.
    """
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            for term, details in key_map.items():
                json_line = json.dumps({
                    "term": term,
                    "definition": details.get("definition", ""),
                    "relevance": details.get("relevance", "Low")
                })
                f.write(json_line + "\n")
        logger.info("Saved key terms to key_terms.jsonl.")
    except Exception as e:
        logger.error(f"Error saving key terms: {e}")

# =======================
# API Endpoints
# =======================

@app.post("/chat")
async def chat(message: Message):
    """
    Handles chat messages from the user, generates a bot response,
    extracts important key terms, and updates memory.
    """
    try:
        user_message = message.message
        logger.info(f"Received message from user: {user_message}")

        # Extract key terms from the user message
        matched_terms = extract_key_terms_from_text(user_message, KEY_TERM_MAP)
        memory_section = construct_memory_section(matched_terms)
        
        # Compose the prompt with memory
        prompt_messages = [
            {"role": "system", "content": "You are a helpful assistant."}
        ]
        
        if memory_section:
            prompt_messages.append({"role": "system", "content": memory_section})
        
        prompt_messages.append({"role": "user", "content": user_message})
        
        # Generate the bot's response
        response = openai.chat.completions.create(
            model="gpt-4o",  # Corrected model name
            messages=prompt_messages,
            max_tokens=2048,
            n=1,
            stop=None,
            temperature=0.7,
        )
        bot_reply = response.choices[0].message.content.strip()
        logger.info(f"Bot reply: {bot_reply}")
        
        # Combine user and bot messages for key term extraction
        combined_text = f"User: {user_message}\nBot: {bot_reply}"
        
        # Define the refined extraction prompt with desired JSON structure
        extraction_prompt = (
    "From the following conversation, extract only the key terms that are essential for understanding the context and are worth remembering. "
    "A key term is considered worth remembering if it is central to the topic, has significant relevance, or is likely to be referenced in future interactions.\n\n"
    f"Conversation:\n{combined_text}\n\n"
    "For each key term, provide its definition and assign a relevance level (High or Medium). Do not include terms with Low relevance. "
    "If there are no key terms worth remembering, return an empty 'key_terms' object.\n\n"
    "Please present the information in valid JSON format as shown below. Ensure that the JSON is properly formatted without any markdown or additional text.\n\n"
    "{\n"
    "  \"key_terms\": {\n"
    "    \"term1\": {\n"
    "      \"definition\": \"definition1\",\n"
    "      \"relevance\": \"High\"\n"
    "    },\n"
    "    \"term2\": {\n"
    "      \"definition\": \"definition2\",\n"
    "      \"relevance\": \"Medium\"\n"
    "    }\n"
    "  }\n"
    "}\n"
)

        
        # Request OpenAI to extract key terms
        extraction_response = openai.chat.completions.create(
            model="gpt-4o",  # Corrected model name
            messages=[
                {"role": "system", "content": "You are an assistant that extracts key terms from conversations and returns data in JSON format."},
                {"role": "user", "content": extraction_prompt},
            ],
            max_tokens=2048,
            n=1,
            stop=None,
            temperature=0.3,
        )
        
        extraction_text = extraction_response.choices[0].message.content.strip()
        logger.info(f"Extraction response: {extraction_text}")
        
        # =======================
        # Parsing Logic Correction
        # =======================
        
        # Remove Markdown code fences if present
        extraction_text = re.sub(r'^```json\s*', '', extraction_text, flags=re.MULTILINE)
        extraction_text = re.sub(r'```\s*$', '', extraction_text, flags=re.MULTILINE)
        extraction_text = extraction_text.strip()
        
        # Attempt to parse the JSON response
        try:
            extraction_data = json.loads(extraction_text)
            key_terms_data = extraction_data.get("key_terms", {})
            
            logger.info(f"Extracted key terms data: {key_terms_data}")
            
            new_terms_added = False
            for term, details in key_terms_data.items():
                definition = details.get("definition", "").strip()
                relevance = details.get("relevance", "Low").strip()
                
                term_normalized = term.strip()
                if term_normalized and term_normalized not in KEY_TERM_MAP:
                    KEY_TERM_MAP[term_normalized] = {
                        "definition": definition,
                        "relevance": relevance
                    }
                    logger.info(f"Added new key term: {term_normalized}")
                    new_terms_added = True
            if new_terms_added:
                # Save the updated key terms to JSONL file
                save_key_terms(KEY_TERMS_FILE, KEY_TERM_MAP)
            else:
                logger.info("No new key terms to add.")
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing extraction JSON: {e}")
            logger.error("Extraction text received:")
            logger.error(extraction_text)
            # Optional: Implement fallback parsing or notify the user/admin
        
        return {"reply": bot_reply}
    
    except Exception as e:
        logger.error(f"Error in /chat endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

# API endpoint to get all key terms
@app.get("/key-terms", response_model=KeyTermsResponse)
async def get_key_terms():
    """
    Retrieves all current key terms.
    """
    try:
        logger.info("Fetching all key terms.")
        # Structure key_terms as a dictionary where each key is the term and the value contains definition and relevance
        key_terms_dict = {
            term: {
                "definition": details["definition"],
                "relevance": details["relevance"]
            }
            for term, details in KEY_TERM_MAP.items()
        }
        return {"key_terms": key_terms_dict}
    except Exception as e:
        logger.error(f"Error fetching key terms: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

# API endpoint to add a new key term
@app.post("/key-terms")
async def add_key_term(key_term: KeyTerm):
    """
    Adds a new key term.
    """
    try:
        term = key_term.term.strip()
        if not term:
            raise HTTPException(status_code=400, detail="Term cannot be empty.")
        if term in KEY_TERM_MAP:
            raise HTTPException(status_code=400, detail="Key term already exists.")
        KEY_TERM_MAP[term] = {
            "definition": key_term.definition.strip() if key_term.definition else "",
            "relevance": key_term.relevance.strip() if key_term.relevance else "Low"
        }
        # Save to JSONL file
        save_key_terms(KEY_TERMS_FILE, KEY_TERM_MAP)
        logger.info(f"Added new key term via API: {term}")
        return {"message": "Key term added successfully."}
    except HTTPException as he:
        logger.warning(f"Failed to add key term: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Error adding key term: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

# API endpoint to update an existing key term
@app.put("/key-terms/{term}")
async def update_key_term(term: str, key_term: KeyTerm):
    """
    Updates an existing key term.
    """
    try:
        term = term.strip()
        if term not in KEY_TERM_MAP:
            raise HTTPException(status_code=404, detail="Key term not found.")
        if key_term.definition is not None:
            KEY_TERM_MAP[term]["definition"] = key_term.definition.strip()
        if key_term.relevance is not None:
            KEY_TERM_MAP[term]["relevance"] = key_term.relevance.strip()
        # Save to JSONL file
        save_key_terms(KEY_TERMS_FILE, KEY_TERM_MAP)
        logger.info(f"Updated key term via API: {term}")
        return {"message": "Key term updated successfully."}
    except HTTPException as he:
        logger.warning(f"Failed to update key term: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Error updating key term: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

# API endpoint to delete a key term
@app.delete("/key-terms/{term}")
async def delete_key_term(term: str):
    """
    Deletes a key term.
    """
    try:
        term = term.strip()
        if term not in KEY_TERM_MAP:
            raise HTTPException(status_code=404, detail="Key term not found.")
        del KEY_TERM_MAP[term]
        # Save to JSONL file
        save_key_terms(KEY_TERMS_FILE, KEY_TERM_MAP)
        logger.info(f"Deleted key term via API: {term}")
        return {"message": "Key term deleted successfully."}
    except HTTPException as he:
        logger.warning(f"Failed to delete key term: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Error deleting key term: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")
