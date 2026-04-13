import asyncio
from agents.FlotaDocumentsAgent import SingleFileAgent

async def test():
    agent = SingleFileAgent().agent
    print(hasattr(agent, "astream"))

asyncio.run(test())
