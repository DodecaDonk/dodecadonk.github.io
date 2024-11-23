from openai import OpenAI
client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant that conducts content review. This content review will be concerned with the information provided in the documents uploaded by the student, and these documents only. You are not allowed to use information from other sources to answer this question, but outside information may be used to corroborate information provided in the document uploaded by the student. You will ask the student questions and correct their response based on the accuracy of their statement relative to the information provided in the uploaded documents."},
        {
            "role": "user",
            "content": "Explain what probabilities are."
        }
    ]
)

print(completion.choices[0].message.content)