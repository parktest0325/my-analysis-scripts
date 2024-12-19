from ghidra.program.model.address import Address
from ghidra.util import Msg

def replace_baseaddr():
    NEW_BASE_ADDR = "0x0000000"
    program = getCurrentProgram()
    address_factory = program.getAddressFactory()
    new_base = address_factory.getAddress(NEW_BASE_ADDR)
    tx = program.startTransaction("Change Image Base")
    program.setImageBase(new_base, True)
    program.endTransaction(tx, True)

replace_baseaddr()