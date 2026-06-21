"""Package setup for covenant-sdk-python."""

from setuptools import find_packages, setup

setup(
    name="covenant-sdk",
    version="0.1.0",
    description="Python SDK for the COVENANT Autonomous Agent Enforcement Protocol",
    author="COVENANT",
    license="MIT",
    packages=find_packages(),
    package_data={"covenant_sdk": ["abis/*.json"]},
    include_package_data=True,
    python_requires=">=3.10",
    install_requires=[
        "web3>=6.0.0",
        "eth-account>=0.10.0",
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries",
    ],
)
